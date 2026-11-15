import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from './worker.mjs';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const payload = { email: 'Person@Example.com', name: 'Researcher', organisation: 'Lab', interests: ['grip-one'], source: 'hardware', campaign: 'research_launch', consent: true, turnstileToken: 'test-token' };
function setup(verification = { success: true, hostname: 'vernia.in', action: 'waitlist' }) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  let verifyCalls = 0;
  const handler = createHandler(async () => { verifyCalls++; return Response.json(verification); });
  const env = { DB: { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) || null; } }; } }; } }, TURNSTILE_SECRET: 'test-only', SIGNUP_LIMITER: { limit: async () => ({ success: true }) } };
  const send = (body = payload, options = {}) => handler(new Request('https://waitlist.example/waitlist', { method: 'POST', headers: { origin: 'https://vernia.in', 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...options.headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);
  return { db, env, handler, send, calls: () => verifyCalls };
}
test('persists normalized signup and returns a signup number only after saving', async () => {
  const { db, send } = setup(); const response = await send(); const result = await response.json();
  assert.equal(response.status, 201); assert.equal(result.position, 1);
  const row = db.prepare('SELECT * FROM waitlist').get();
  assert.equal(row.email, 'person@example.com'); assert.equal(row.source, 'hardware'); assert.equal(row.consent_version, '2026-11-15'); assert.equal(row.status, 'waiting');
  assert.deepEqual(JSON.parse(row.interests), ['grip-one']);
});
test('duplicate attempts keep existing details and do not expose their queue number', async () => {
  const { db, send } = setup(); await send();
  const duplicate = await send({ ...payload, name: 'Attacker', interests: ['data'] });
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).position, undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n, 1);
  assert.equal(db.prepare('SELECT name FROM waitlist').get().name, 'Researcher');
  const next = await send({ ...payload, email: 'second@example.com' }); assert.equal((await next.json()).position, 2);
});
test('concurrent duplicate requests produce exactly one entry', async () => {
  const { send, db } = setup(); const responses = await Promise.all(Array.from({ length: 12 }, () => send()));
  assert.equal(responses.filter(r => r.status === 201).length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n, 1);
});
test('rejects invalid fields, missing consent, honeypots, and oversized bodies before verification', async () => {
  const { send, db, calls } = setup();
  for (const input of [null, [], { ...payload, email: 'invalid' }, { ...payload, consent: false }, { ...payload, interests: [] }, { ...payload, interests: ['unknown'] }, { ...payload, name: 'a'.repeat(101) }, { ...payload, website: 'spam' }, { ...payload, turnstileToken: '' }, { ...payload, email: 'a\n@example.com' }, 'x'.repeat(9000), '{']) assert.equal((await send(input)).status, 400);
  assert.equal(calls(), 0); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n, 0);
});
test('rejects invalid, wrong-host, and wrong-action Turnstile tokens', async () => {
  for (const result of [{ success: false }, { success: true, hostname: 'attacker.example', action: 'waitlist' }, { success: true, hostname: 'vernia.in', action: 'login' }]) {
    const { send, db } = setup(result); assert.equal((await send()).status, 400); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n, 0);
  }
});
test('enforces allowed origins, methods, preflight, and rate limiting', async () => {
  const { send, env, handler, calls } = setup();
  const forbidden = await send(payload, { headers: { origin: 'https://evil.example' } }); assert.equal(forbidden.status, 403); assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await handler(new Request('https://waitlist.example/waitlist', { method: 'OPTIONS', headers: { Origin: 'https://vernia.in' } }), env); assert.equal(preflight.status, 204);
  assert.equal((await handler(new Request('https://waitlist.example/waitlist', { headers: { Origin: 'https://vernia.in' } }), env)).status, 405);
  env.SIGNUP_LIMITER.limit = async () => ({ success: false }); const limited = await send(); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60'); assert.equal(calls(), 0);
});
test('fails closed if configuration, verification, or storage is unavailable', async () => {
  const { send, env } = setup(); env.DB.prepare = () => { throw new Error('private database detail'); };
  const failed = await send(); assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes('private database'));
  env.TURNSTILE_SECRET = ''; assert.equal((await send()).status, 503);
});
test('uses bound SQL parameters and restricts campaign labels', async () => {
  const { send, db } = setup(); await send({ ...payload, name: "'); DROP TABLE waitlist;--", campaign: 'person@example.com' });
  const row = db.prepare('SELECT * FROM waitlist').get(); assert.equal(row.name, "'); DROP TABLE waitlist;--"); assert.equal(row.campaign, '');
});
test('accepts the View One headset and a data pilot from the homepage form', async () => {
  const { db, send } = setup();
  const response = await send({ ...payload, email: 'lab@example.com', interests: ['data', 'grip-one', 'headset'], source: 'home' });
  assert.equal(response.status, 201);
  const row = db.prepare('SELECT * FROM waitlist').get();
  assert.deepEqual(JSON.parse(row.interests), ['data', 'grip-one', 'headset']);
  assert.equal(row.source, 'home');
  const unknown = await send({ ...payload, email: 'x@example.com', interests: ['jetpack'] });
  assert.equal(unknown.status, 400);
});
