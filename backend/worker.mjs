const ORIGINS = new Set(['https://vernia.in', 'https://www.vernia.in']);
const INTERESTS = new Set(['grip-one', 'headset', 'tactile-gloves', 'data']);
const SOURCES = new Set(['home', 'hardware', 'direct']);
const MAX_BODY = 8192;

export function validateSignup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Check the form and try again.');
  const text = (value, max) => {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Check the form and try again.');
    return value.trim();
  };
  const email = text(input.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) throw new Error('Enter a valid email address.');
  if (input.consent !== true) throw new Error('Please agree to receive updates about your selected interests.');
  if (!Array.isArray(input.interests) || !input.interests.length || input.interests.length > 4 || input.interests.some(item => !INTERESTS.has(item))) throw new Error('Choose at least one interest.');
  if (text(input.website, 300)) throw new Error('We could not accept this submission.');
  const token = text(input.turnstileToken, 2048);
  if (!token) throw new Error('Complete the security check and try again.');
  const campaign = text(input.campaign, 80);
  const analyticsSession = typeof input.analyticsSession === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.analyticsSession) ? input.analyticsSession : '';
  return { email, name: text(input.name, 100), organisation: text(input.organisation, 160), interests: [...new Set(input.interests)], source: SOURCES.has(input.source) ? input.source : 'direct', campaign: /^[a-zA-Z0-9_-]{0,80}$/.test(campaign) ? campaign : '', token, analyticsSession };
}

async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Send the form as JSON.');
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('The submission is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('The form is empty.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('The submission is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('The form could not be read.'); }
}

export function createHandler(verifyFetch = fetch, onSignup = async () => {}) {
  return async (request, env) => {
    const origin = request.headers.get('origin');
    const allowed = ORIGINS.has(origin);
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin' };
    if (allowed) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return reply(200, { ok: true, service: 'vernia-waitlist' });
    if (path !== '/waitlist') return reply(404, { error: 'Not found.' });
    if (!allowed) return reply(403, { error: 'Please use the waitlist form at vernia.in.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });
    if (!env.DB || !env.TURNSTILE_SECRET || !env.SIGNUP_LIMITER) return reply(503, { error: 'The waitlist is temporarily unavailable. Please try again later.' });
    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return reply(403, { error: 'Unable to verify the request.' });
      const rate = await env.SIGNUP_LIMITER.limit({ key: `signup:${ip}` });
      if (!rate.success) return reply(429, { error: 'Too many attempts. Please wait a minute and try again.' }, { 'Retry-After': '60' });
      let signup;
      try { signup = validateSignup(await readBody(request)); }
      catch (error) { return reply(400, { error: error.message }); }
      const verification = await verifyFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: signup.token, remoteip: ip }),
      });
      if (!verification.ok) return reply(503, { error: 'The security check is temporarily unavailable. Please try again.' });
      const result = await verification.json();
      if (!result.success || !['vernia.in', 'www.vernia.in'].includes(result.hostname) || result.action !== 'waitlist') return reply(400, { error: 'The security check expired or failed. Please try again.' });
      // The unique constraint and single INSERT keep concurrent submissions safe.
      // Existing emails are not updated or disclosed to an unauthenticated submitter.
      const row = await env.DB.prepare(`INSERT INTO waitlist (email, name, organisation, interests, source, campaign, consent_version)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM waitlist WHERE email = ?)
        ON CONFLICT(email) DO NOTHING RETURNING id`).bind(signup.email, signup.name, signup.organisation, JSON.stringify(signup.interests), signup.source, signup.campaign, '2026-11-15', signup.email).first();
      if (!row) return reply(200, { accepted: true, message: 'Your request has been received. If this email is already registered, its original place and preferences are unchanged.' });
      // Reporting failures must never turn an accepted signup into an error.
      try { await onSignup(signup, row, env); } catch {}
      return reply(201, { accepted: true, position: row.id, message: 'You’re on the Vernia waitlist.' });
    } catch {
      // Never log form payloads, email addresses, IPs, or provider secrets.
      return reply(503, { error: 'We could not save your request. Please try again in a moment.' });
    }
  };
}

export default { fetch: createHandler() };
