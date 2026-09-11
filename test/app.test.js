'use strict';

const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const API = 'https://sendbeam.io';
const authData = { api_key: 'sb_test_key' };
const contact = { id: 'c-1', email: 'ada@example.com', status: 'subscribed', first_name: 'Ada', created_at: '2026-09-05T09:12:00.000Z' };

beforeEach(() => nock.disableNetConnect());
afterEach(() => { const done = nock.isDone(); const pending = nock.pendingMocks(); nock.cleanAll(); expect(pending).toEqual([]); expect(done).toBe(true); });

describe('authentication', () => {
  test('sends the key as x-api-key and passes on 200', async () => {
    nock(API, { reqheaders: { 'x-api-key': 'sb_test_key' } }).get('/api/v1/contacts').query({ limit: 1 }).reply(200, { contacts: [], pagination: {} });
    await expect(appTester(App.authentication.test, { authData })).resolves.toEqual({ ok: true });
  });
  test('turns a 401 into a re-auth error with SendBeam\'s message', async () => {
    nock(API).get('/api/v1/contacts').query(true).reply(401, { error: 'Invalid API key' });
    await expect(appTester(App.authentication.test, { authData })).rejects.toThrow('Invalid API key');
  });
});

describe('hook triggers', () => {
  const trig = App.triggers.new_contact.operation;
  test('subscribe creates a webhook for the event and keeps its id', async () => {
    nock(API).post('/api/v1/webhooks', (body) => body.url === 'https://hooks.zapier.com/x' && body.event_types[0] === 'contact.created').reply(201, { webhook: { id: 'wh-9' }, secret: 's' });
    await expect(appTester(trig.performSubscribe, { authData, targetUrl: 'https://hooks.zapier.com/x' })).resolves.toEqual({ id: 'wh-9' });
  });
  test('unsubscribe deletes it and tolerates 404', async () => {
    nock(API).delete('/api/v1/webhooks/wh-9').reply(404, { error: 'gone' });
    await expect(appTester(trig.performUnsubscribe, { authData, subscribeData: { id: 'wh-9' } })).resolves.toEqual({ ok: true });
  });
  // Real contact deliveries carry the person under data.contact. Zaps are built
  // from the flat sample, so perform must hand Zapier the same flat fields.
  test('perform flattens data.contact and uses the delivery id for dedupe', async () => {
    const out = await appTester(trig.perform, { authData, cleanedRequest: { id: 'ev-1', event: 'contact.created', created_at: '2026-09-05T10:00:00Z', data: { contact } } });
    expect(out).toEqual([{ ...contact, event_id: 'ev-1', event_at: '2026-09-05T10:00:00Z' }]);
    expect(out[0].email).toBe(contact.email);
    expect(out[0]).not.toHaveProperty('contact');
  });
  test('perform ignores a delivery for another event', async () => {
    await expect(appTester(trig.perform, { authData, cleanedRequest: { id: 'ev-2', event: 'contact.updated', data: { contact } } })).resolves.toEqual([]);
  });
  test('list-member trigger filters by the chosen list and keeps the list beside the contact', async () => {
    const op = App.triggers.new_list_member.operation;
    const delivery = { id: 'ev-3', event: 'contact.list_joined', data: { contact, list: { id: 'L1', name: 'News' } } };
    await expect(appTester(op.perform, { authData, inputData: { list_id: 'L2' }, cleanedRequest: delivery })).resolves.toEqual([]);
    const kept = await appTester(op.perform, { authData, inputData: { list_id: 'L1' }, cleanedRequest: delivery });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ email: contact.email, list: { id: 'L1', name: 'News' }, event_id: 'ev-3' });
  });
  test('a form submission, already flat, passes through unchanged', async () => {
    const op = App.triggers.form_submission.operation;
    const data = { form_id: 'f-1', form_name: 'Signup', form_kind: 'signup', submission_id: 's-1', email: 'ada@example.com', fields: {} };
    const out = await appTester(op.perform, { authData, inputData: {}, cleanedRequest: { id: 'ev-4', event: 'form.submitted', created_at: '2026-09-05T10:00:00Z', data } });
    expect(out).toEqual([{ ...data, event_id: 'ev-4', event_at: '2026-09-05T10:00:00Z' }]);
  });
  test('form trigger filters by form id case-insensitively', async () => {
    const op = App.triggers.form_submission.operation;
    const delivery = { id: 'ev-4', event: 'form.submitted', data: { form_id: 'abc', email: 'x@y.z' } };
    await expect(appTester(op.perform, { authData, inputData: { form_id: 'ABC ' }, cleanedRequest: delivery })).resolves.toHaveLength(1);
  });
  test('performList gives recent contacts with event fields', async () => {
    nock(API).get('/api/v1/contacts').query({ limit: 25 }).reply(200, { contacts: [contact] });
    const out = await appTester(trig.performList, { authData });
    expect(out[0].event_id).toBe('contact.created:c-1');
  });
});

describe('creates', () => {
  test('create_contact: new contact, then list and tag', async () => {
    nock(API).post('/api/v1/contacts', (b) => b.email === 'ada@example.com' && b.source === 'zapier' && b.resubscribe === undefined).reply(201, { contact });
    nock(API).post('/api/v1/lists/L1/contacts', { contact_id: 'c-1' }).reply(201, {});
    nock(API).post('/api/v1/contacts/c-1/tags', { tag_id: 'T1' }).reply(201, {});
    const out = await appTester(App.creates.create_contact.operation.perform, { authData, inputData: { email: 'ada@example.com', list_id: 'L1', tag_id: 'T1' } });
    expect(out).toEqual({ ...contact, created: true });
  });
  test('create_contact: 409 falls back to lookup + PATCH, list 409 is fine', async () => {
    nock(API).post('/api/v1/contacts').reply(409, { error: 'A contact with this email already exists' });
    nock(API).get('/api/v1/contacts').query({ q: 'Ada@Example.com', limit: 5 }).reply(200, { contacts: [contact] });
    nock(API).patch('/api/v1/contacts/c-1', { first_name: 'Ada' }).reply(200, { contact: { ...contact, first_name: 'Ada' } });
    nock(API).post('/api/v1/lists/L1/contacts').reply(409, { error: 'already a member' });
    const out = await appTester(App.creates.create_contact.operation.perform, { authData, inputData: { email: 'Ada@Example.com', first_name: 'Ada', list_id: 'L1' } });
    expect(out.created).toBe(false);
    expect(out.id).toBe('c-1');
  });
  test('create_contact: a 403 explains the missing permission', async () => {
    nock(API).post('/api/v1/contacts').reply(403, { error: 'Forbidden: contacts:write permission required' });
    await expect(appTester(App.creates.create_contact.operation.perform, { authData, inputData: { email: 'a@b.c' } })).rejects.toThrow(/contacts:write.*API keys/);
  });
  test('add_to_list creates the contact when new', async () => {
    nock(API).post('/api/v1/contacts').reply(201, { contact });
    nock(API).post('/api/v1/lists/L1/contacts', { contact_id: 'c-1' }).reply(201, {});
    await expect(appTester(App.creates.add_to_list.operation.perform, { authData, inputData: { email: 'ada@example.com', list_id: 'L1' } })).resolves.toEqual({ contact_id: 'c-1', email: 'ada@example.com', list_id: 'L1', added: true });
  });
  test('add_tag fails clearly for an unknown email', async () => {
    nock(API).get('/api/v1/contacts').query(true).reply(200, { contacts: [] });
    await expect(appTester(App.creates.add_tag.operation.perform, { authData, inputData: { email: 'no@one.io', tag_id: 'T1' } })).rejects.toThrow('No contact with the email no@one.io');
  });
  test('send_email resolves the contact and posts to /send', async () => {
    nock(API).get('/api/v1/contacts').query(true).reply(200, { contacts: [contact] });
    nock(API).post('/api/v1/send', (b) => b.contact_id === 'c-1' && b.subject === 'Hi {{first_name}}' && b.html_content === '<p>x</p>' && !('text_content' in b)).reply(200, { send_id: 's-1', status: 'queued' });
    const out = await appTester(App.creates.send_email.operation.perform, { authData, inputData: { email: 'ada@example.com', subject: 'Hi {{first_name}}', html_content: '<p>x</p>' } });
    expect(out).toMatchObject({ send_id: 's-1', status: 'queued', contact_id: 'c-1' });
  });
  test('send_email: a 429 becomes a throttled error so Zapier retries later', async () => {
    nock(API).get('/api/v1/contacts').query(true).reply(200, { contacts: [contact] });
    nock(API).post('/api/v1/send').reply(429, { error: 'Hourly send limit reached' }, { 'Retry-After': '120' });
    await expect(appTester(App.creates.send_email.operation.perform, { authData, inputData: { email: 'ada@example.com', subject: 's', html_content: 'h' } })).rejects.toThrow(/429/);
  });
});

describe('search + resources', () => {
  test('find_contact matches on email exactly', async () => {
    nock(API).get('/api/v1/contacts').query({ q: 'ada@example.com', limit: 5 }).reply(200, { contacts: [{ ...contact, email: 'ada@example.community' }, contact] });
    const out = await appTester(App.searches.find_contact.operation.perform, { authData, inputData: { email: 'ada@example.com' } });
    expect(out).toEqual([contact]);
  });
  test('form dropdown', async () => {
    nock(API).get('/api/v1/forms').reply(200, { forms: [{ id: 'F1', name: 'Homepage signup', kind: 'signup' }] });
    await expect(appTester(App.resources.form.list.operation.perform, { authData })).resolves.toEqual([{ id: 'F1', name: 'Homepage signup' }]);
  });
  test('list dropdown', async () => {
    nock(API).get('/api/v1/lists').reply(200, { lists: [{ id: 'L1', name: 'News', extra: 1 }] });
    await expect(appTester(App.resources.list.list.operation.perform, { authData })).resolves.toEqual([{ id: 'L1', name: 'News' }]);
  });
});
