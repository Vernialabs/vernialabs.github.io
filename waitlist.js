import { siteConfig } from './site-config.js';

const form = document.querySelector('#waitlist-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
const success = document.querySelector('#signup-success');
const params = new URLSearchParams(location.search);
const interests = ['grip-one', 'tactile-gloves', 'data'];
const selected = params.get('interest');
if (interests.includes(selected)) form.querySelector(`input[value="${selected}"]`).checked = true;
const sources = new Set(['home', 'hardware']);
const source = sources.has(params.get('from')) ? params.get('from') : 'direct';
const campaignValue = params.get('utm_campaign') || '';
const campaign = /^[a-zA-Z0-9_-]{1,80}$/.test(campaignValue) ? campaignValue : '';
let token = '';
let widget;
let sending = false;
function message(text) { status.textContent = text; }
function resetChallenge() {
  token = '';
  submit.disabled = true;
  if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
}
function initializeChallenge() {
  widget = window.turnstile.render('#security-check', {
    sitekey: siteConfig.turnstileSiteKey, action: 'waitlist', theme: 'light', size: form.clientWidth < 300 ? 'compact' : 'flexible',
    callback(value) { token = value; submit.disabled = sending; message(''); },
    'expired-callback'() { token = ''; submit.disabled = true; message('Please complete the security check again.'); },
    'error-callback'() { token = ''; submit.disabled = true; message('The security check could not load. Check your connection or contact us by email.'); },
  });
}
if (siteConfig.turnstileSiteKey && siteConfig.waitlistEndpoint) {
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = initializeChallenge;
  script.onerror = () => message('The security check could not load. Please refresh or contact us by email.');
  document.head.append(script);
} else {
  message('Online signup is being connected. Please contact us by email in the meantime.');
}
form.addEventListener('change', () => form.querySelector('input[name="interest"]').setCustomValidity(''));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || !token) return;
  const data = new FormData(form);
  const chosen = data.getAll('interest');
  if (!chosen.length) {
    const checkbox = form.querySelector('input[name="interest"]');
    checkbox.setCustomValidity('Choose at least one interest.'); checkbox.reportValidity(); return;
  }
  if (!form.reportValidity()) return;
  sending = true; submit.disabled = true; submit.textContent = 'Saving your place…'; message('');
  try {
    const response = await fetch(siteConfig.waitlistEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ email: data.get('email'), name: data.get('name'), organisation: data.get('organisation'), interests: chosen, consent: data.get('consent') === 'yes', website: data.get('website'), source, campaign, turnstileToken: token, analyticsSession: window.verniaAnalyticsSession?.() || '' }),
    });
    const result = await response.json();
    if (!response.ok || result.accepted !== true) throw new Error(result.error || 'We could not save your request. Please try again.');
    success.querySelector('h2').textContent = result.position ? 'You’re on the list.' : 'Request received.';
    success.querySelector('[data-success-message]').textContent = result.message;
    const position = success.querySelector('[data-position]');
    if (Number.isSafeInteger(result.position) && result.position > 0) { position.hidden = false; position.textContent = `Your signup number is #${result.position}.`; }
    form.hidden = true; success.hidden = false; success.focus();
  } catch (error) {
    message(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'The request timed out. You can safely retry; an email can only join once.' : error instanceof TypeError ? 'We could not reach the waitlist. Check your connection and try again.' : error.message);
    resetChallenge();
  } finally { sending = false; submit.textContent = 'Join the waitlist'; if (token) submit.disabled = false; }
});
