'use strict';

const fs = require('fs');
const path = require('path');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');
const pkg = require('../package.json');
const { EVENTS, HIDDEN_EVENTS } = require('../src/triggers');

const appTester = zapier.createAppTester(App);
const API = 'https://sendbeam.io';
const V1 = '/api/v1';
const authData = { api_key: 'sb_live_ab12cd34_notarealsecret' };

const C = '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10';
const L = '9c2b1a0f-1111-4222-8333-444455556666';
const L2 = '9c2b1a0f-1111-4222-8333-777788889999';
const T = '5d6e7f80-2222-4333-8444-555566667777';
const T2 = '5d6e7f80-2222-4333-8444-000011112222';
const CMP = '2f9c1b1e-3f9e-4a3b-9c2f-1d1e2f3a4b5c';
const A = 'f6e5d4c3-b2a1-4f0e-9d8c-7b6a5f4e3d2c';
const OTHER = '00000000-1111-4222-8333-444444444444';
const AT = '2026-09-05T10:00:00.000Z';
const contact = { id: C, email: 'ada@example.com', status: 'subscribed', first_name: 'Ada', last_name: 'Lovelace', custom_fields: { plan: 'starter' }, created_at: '2026-09-05T09:12:00.000Z' };

const run = (operation, bundle = {}) => appTester(operation, { authData, ...bundle });
const perform = (type, key, inputData) => run(App[type][key].operation.perform, { inputData });

/** The by-email lookup most actions start with: one page of `q` results. */
const lookup = (email, contacts) =>
  nock(API).get(`${V1}/contacts`).query({ q: email, page: 1, limit: 100 }).reply(200, { contacts, pagination: { page: 1, limit: 100, total: contacts.length, total_pages: 1 } });

beforeEach(() => nock.disableNetConnect());
afterEach(() => { const done = nock.isDone(); const pending = nock.pendingMocks(); nock.cleanAll(); expect(pending).toEqual([]); expect(done).toBe(true); });

describe('authentication', () => {
  test('sends the key as x-api-key and labels the connection with the key\'s public part', async () => {
    nock(API, { reqheaders: { 'x-api-key': authData.api_key, 'user-agent': (ua) => String(ua).includes(`SendBeam-Zapier/${pkg.version}`) } })
      .get(`${V1}/contacts`).query({ limit: 1 }).reply(200, { contacts: [], pagination: {} });
    const out = await run(App.authentication.test);
    expect(out).toEqual({ ok: true, key_hint: 'sb_live_ab12cd34' });
    expect(App.authentication.connectionLabel).toContain('{{bundle.inputData.key_hint}}');
    expect(JSON.stringify(out)).not.toContain('notarealsecret');
  });
  test('turns a 401 into a re-auth error with SendBeam\'s message', async () => {
    nock(API).get(`${V1}/contacts`).query(true).reply(401, { error: 'Invalid API key' });
    await expect(run(App.authentication.test)).rejects.toThrow('Invalid API key');
  });
});

describe('the app', () => {
  test('is version 1.2.1 with 19 triggers (and 2 hidden), 17 actions and 5 searches', () => {
    expect(App.version).toBe('1.2.1');
    expect(pkg.version).toBe('1.2.1');
    expect(Object.values(App.triggers).filter((t) => !t.display.hidden)).toHaveLength(19);
    expect(Object.values(App.triggers).filter((t) => t.display.hidden).map((t) => t.key).sort()).toEqual(['domain_failed', 'domain_verified']);
    expect(Object.keys(App.creates)).toHaveLength(17);
    expect(Object.keys(App.searches)).toHaveLength(5);
    expect(Object.keys(App.resources).sort()).toEqual(['automation', 'campaign', 'form', 'list', 'segment', 'tag']);
  });
  test('keeps input as entered, so merge tags and empty values reach the actions', () => {
    expect(App.flags).toEqual({ cleanInputData: false });
  });
  test('offers find-or-create for contacts, lists and tags', () => {
    for (const [key, pair] of Object.entries(App.searchOrCreates)) {
      expect(pair.key).toBe(key);
      expect(App.searches[pair.search]).toBeDefined();
      expect(App.creates[pair.create]).toBeDefined();
    }
    expect(Object.values(App.searchOrCreates).map((p) => `${p.search}/${p.create}`).sort()).toEqual(['find_contact/create_contact', 'find_list/create_list', 'find_tag/create_tag']);
  });

  const definitions = [
    ...Object.values(App.triggers),
    ...Object.values(App.creates),
    ...Object.values(App.searches),
    ...Object.values(App.resources).map((r) => r.list),
  ];
  const helpText = [
    ...App.authentication.fields.flatMap((f) => [f.label, f.helpText]),
    ...Object.values(App.searchOrCreates).flatMap((p) => [p.display.label, p.display.description]),
    ...definitions.flatMap((d) => [d.display.label, d.display.description, ...(d.operation.inputFields || []).flatMap((f) => [f.label, f.helpText])]),
  ].filter(Boolean);
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

  test('help text names permissions, never plans, limits, security measures or third-party services', () => {
    const rules = [
      [/\b(?:free|starter|pro|business|premium|paid)\b|\bplans?\b|\bupgrade\b/i, 'a plan'],
      [/\d[\d,.]*\s*(?:\w+\s+)?(?:per|an?|\/)\s*(?:second|minute|hour|day|month)\b|\brate.?limit|\bquota\b|\bthrottl/i, 'a limit'],
      [/\b(?:secret|signature|signing|encrypt\w*|hash\w*|firewall)\b/i, 'a security measure'],
      // Any third-party service by name: SendBeam's own features are described, not whose infrastructure is behind them.
      [/\b(?:amazon|aws|google|microsoft|azure|mailchimp|mailgun|mailjet|mandrill|postmark|sendgrid|sparkpost|brevo|sendinblue|resend|ses|smtp2go|socketlabs|mailersend|zeptomail|cloudflare|fastly|vercel)\b/i, 'a third-party service'],
    ];
    for (const [pattern, what] of rules) {
      expect(helpText.filter((t) => pattern.test(t)).map((t) => `${what}: ${t}`)).toEqual([]);
      expect(readme.split('\n').filter((t) => pattern.test(t)).map((t) => `${what}: ${t}`)).toEqual([]);
    }
  });
  test('every action and search says which permissions it needs', () => {
    const missing = [...Object.values(App.creates), ...Object.values(App.searches)].filter((d) => !/\b[a-z]+:(?:read|write|send)\b/.test(d.display.description));
    expect(missing.map((d) => d.key)).toEqual([]);
  });
  test('every output field is in the sample', () => {
    // Contact forms send name, subject and message; the sample is a signup form.
    const otherFormKind = ['form_submission/name', 'form_submission/subject', 'form_submission/message'];
    const missing = definitions.flatMap((d) =>
      (d.operation.outputFields || [])
        .filter((f) => f.key.split('__').reduce((o, part) => (o == null ? undefined : o[part]), d.operation.sample) === undefined)
        .map((f) => `${d.key}/${f.key}`),
    );
    expect(missing.filter((k) => !otherFormKind.includes(k))).toEqual([]);
  });
});

describe('instant triggers', () => {
  test('there is one trigger per SendBeam event, the sending-domain ones hidden', () => {
    expect(Object.keys(App.triggers).sort()).toEqual([...Object.keys(EVENTS), ...Object.keys(HIDDEN_EVENTS)].sort());
    expect(new Set(Object.values(EVENTS)).size).toBe(19);
    expect(Object.values(EVENTS).filter((e) => e.startsWith('domain.'))).toEqual([]);
    expect(Object.keys(HIDDEN_EVENTS).filter((k) => !App.triggers[k].display.hidden)).toEqual([]);
  });

  describe.each(Object.entries(EVENTS))('%s', (key, event) => {
    const trigger = App.triggers[key];
    const op = trigger.operation;
    const { event_id: _eventId, event_at: _eventAt, ...fields } = op.sample;

    /** A delivery as SendBeam sends it: contact events nest the person under data.contact. */
    const delivery = (overrides = {}) => {
      let data = { ...fields, ...overrides };
      if (event.startsWith('contact.')) {
        const { list, tag, ...person } = data;
        data = { contact: person, ...(list ? { list } : {}), ...(tag ? { tag } : {}) };
      }
      return { id: 'dlv-1', event, created_at: AT, data };
    };

    test('subscribes a webhook endpoint for its event', async () => {
      nock(API)
        .post(`${V1}/webhooks`, { url: 'https://hooks.zapier.com/x', event_types: [event], description: `Zapier: ${trigger.display.label}` })
        .reply(201, { id: 'wh-9' });
      await expect(run(op.performSubscribe, { targetUrl: 'https://hooks.zapier.com/x', inputData: {} })).resolves.toEqual({ id: 'wh-9' });
    });
    test('hands Zapier the same flat fields as its sample, deduped on the delivery id', async () => {
      const out = await run(op.perform, { inputData: {}, cleanedRequest: delivery() });
      expect(out).toEqual([{ ...fields, event_id: 'dlv-1', event_at: AT }]);
      expect(out[0]).not.toHaveProperty('contact');
    });
    test('ignores a delivery for another event', async () => {
      const other = event === 'contact.updated' ? 'contact.created' : 'contact.updated';
      await expect(run(op.perform, { inputData: {}, cleanedRequest: { ...delivery(), event: other } })).resolves.toEqual([]);
    });
    test('tests with its latest real events, mapped exactly as a delivery is', async () => {
      const older = { ...delivery(), id: 'dlv-0', created_at: '2026-09-04T10:00:00.000Z' };
      nock(API).get(`${V1}/events`).query({ type: event, limit: 25 }).reply(200, { events: [delivery(), older] });
      const out = await run(op.performList, { inputData: {} });
      const live = [
        ...(await run(op.perform, { inputData: {}, cleanedRequest: delivery() })),
        ...(await run(op.perform, { inputData: {}, cleanedRequest: older })),
      ];
      expect(out).toEqual(live);
      expect(Object.keys(out[0]).sort()).toEqual(Object.keys(op.sample).sort());
      for (const field of op.outputFields.filter((f) => f.type === 'datetime' && out[0][f.key] != null)) {
        expect(out[0][field.key]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
      }
    });
  });

  const filtered = {
    tag_added: ['tag_id', 'tag_ids', (s) => s.tag.id],
    tag_removed: ['tag_id', 'tag_ids', (s) => s.tag.id],
    new_list_member: ['list_id', 'list_ids', (s) => s.list.id],
    list_member_removed: ['list_id', 'list_ids', (s) => s.list.id],
    email_sent: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    email_delivered: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    email_opened: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    email_clicked: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    email_bounced: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    email_complained: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    campaign_sent: ['campaign_id', 'campaign_ids', (s) => s.campaign_id],
    form_submission: ['form_id', 'form_ids', (s) => s.form_id],
  };

  test('only list, tag, email, campaign and form triggers take a filter', () => {
    const withInput = Object.values(App.triggers).filter((t) => t.operation.inputFields.length).map((t) => t.key);
    expect(withInput.sort()).toEqual(Object.keys(filtered).sort());
  });

  test.each(Object.entries(filtered))('%s sends its filter to SendBeam and checks it again on delivery', async (key, [input, dimension, valueOf]) => {
    const op = App.triggers[key].operation;
    const chosen = valueOf(op.sample);
    nock(API).post(`${V1}/webhooks`, (b) => JSON.stringify(b.filters) === JSON.stringify({ [dimension]: [chosen] })).reply(201, { id: 'wh-1' });
    await run(op.performSubscribe, { targetUrl: 'https://hooks.zapier.com/x', inputData: { [input]: ` ${chosen.toUpperCase()} ` } });

    const { event_id: _e, event_at: _a, ...fields } = op.sample;
    let data = fields;
    if (EVENTS[key].startsWith('contact.')) {
      const { list, tag, ...person } = fields;
      data = { contact: person, ...(list ? { list } : {}), ...(tag ? { tag } : {}) };
    }
    const cleanedRequest = { id: 'dlv-2', event: EVENTS[key], created_at: AT, data };
    await expect(run(op.perform, { inputData: { [input]: chosen }, cleanedRequest })).resolves.toHaveLength(1);
    await expect(run(op.perform, { inputData: { [input]: OTHER }, cleanedRequest })).resolves.toEqual([]);
  });

  test('an email that is not part of any campaign still triggers when no campaign is chosen', async () => {
    const op = App.triggers.email_sent.operation;
    const cleanedRequest = { id: 'dlv-3', event: 'email.sent', created_at: AT, data: { send_id: 's-1', email: 'ada@example.com', campaign_id: null, kind: 'single' } };
    await expect(run(op.perform, { inputData: { campaign_id: '' }, cleanedRequest })).resolves.toHaveLength(1);
  });

  test('unsubscribe deletes the endpoint and tolerates one already gone', async () => {
    nock(API).delete(`${V1}/webhooks/wh-9`).reply(404, { error: 'Webhook not found' });
    await expect(run(App.triggers.contact_deleted.operation.performUnsubscribe, { subscribeData: { id: 'wh-9' } })).resolves.toEqual({ ok: true });
  });
  test('unsubscribe reports any other failure', async () => {
    nock(API).delete(`${V1}/webhooks/wh-9`).reply(500, { error: 'Failed to delete webhook' });
    await expect(run(App.triggers.contact_deleted.operation.performUnsubscribe, { subscribeData: { id: 'wh-9' } })).rejects.toThrow('Failed to delete webhook');
  });

  describe('sample data', () => {
    const noEvents = (event) => nock(API).get(`${V1}/events`).query({ type: event, limit: 25 }).reply(200, { events: [] });

    test('a chosen tag, list, campaign or form narrows the recent events too', async () => {
      const tagged = (tagId, id) => ({ id, event: 'contact.tag_added', created_at: AT, data: { contact, tag: { id: tagId, name: 'VIP' } } });
      nock(API).get(`${V1}/events`).query({ type: 'contact.tag_added', limit: 25 }).reply(200, { events: [tagged(T, 'dlv-1'), tagged(T2, 'dlv-2')] });
      const out = await run(App.triggers.tag_added.operation.performList, { inputData: { tag_id: T2.toUpperCase() } });
      expect(out).toEqual([{ ...contact, tag: { id: T2, name: 'VIP' }, event_id: 'dlv-2', event_at: AT }]);
    });
    test('a key without webhooks:read still gets records from the workspace', async () => {
      nock(API).get(`${V1}/events`).query(true).reply(403, { error: 'Forbidden: webhooks:read permission required' });
      nock(API).get(`${V1}/contacts`).query({ limit: 25 }).reply(200, { contacts: [contact] });
      await expect(run(App.triggers.new_contact.operation.performList)).resolves.toHaveLength(1);
    });
    test('any other failure to load events is reported', async () => {
      nock(API).get(`${V1}/events`).query(true).reply(500, { error: 'Failed to list events' });
      await expect(run(App.triggers.email_opened.operation.performList)).rejects.toThrow('Failed to list events');
    });
    test('New Contact lists recent contacts, with only the fields the event carries, before any event is recorded', async () => {
      noEvents('contact.created');
      nock(API).get(`${V1}/contacts`).query({ limit: 25 }).reply(200, { contacts: [{ ...contact, tenant_id: 'ws-1' }] });
      const out = await run(App.triggers.new_contact.operation.performList);
      expect(out).toEqual([{ ...contact, event_id: `contact.created:${C}`, event_at: contact.created_at }]);
    });
    test.each([
      ['new_unsubscribe', 'unsubscribed'],
      ['contact_bounced', 'bounced'],
      ['contact_complained', 'complained'],
    ])('%s lists contacts with status %s', async (key, status) => {
      const row = { ...contact, status, unsubscribed_at: '2026-09-06T08:00:00.000Z' };
      noEvents(EVENTS[key]);
      nock(API).get(`${V1}/contacts`).query({ limit: 25, status }).reply(200, { contacts: [row] });
      const out = await run(App.triggers[key].operation.performList);
      expect(out[0]).toMatchObject({ email: 'ada@example.com', status, event_id: `${EVENTS[key]}:${C}` });
      if (key === 'new_unsubscribe') expect(out[0].event_at).toBe('2026-09-06T08:00:00.000Z');
    });
    test('Contact Updated lists recent contacts', async () => {
      noEvents('contact.updated');
      nock(API).get(`${V1}/contacts`).query({ limit: 25 }).reply(200, { contacts: [contact] });
      await expect(run(App.triggers.contact_updated.operation.performList)).resolves.toEqual([{ ...contact, event_id: `contact.updated:${C}`, event_at: contact.created_at }]);
    });
    test('Contact Added to List lists members of the chosen list', async () => {
      noEvents('contact.list_joined');
      nock(API).get(`${V1}/lists`).reply(200, { lists: [{ id: L, name: 'News' }, { id: L2, name: 'Offers' }] });
      nock(API).get(`${V1}/lists/${L2}/contacts`).query({ limit: 25 }).reply(200, { contacts: [{ ...contact, added_at: AT }], pagination: {} });
      const out = await run(App.triggers.new_list_member.operation.performList, { inputData: { list_id: L2.toUpperCase() } });
      expect(out).toEqual([{ ...contact, list: { id: L2, name: 'Offers' }, event_id: `contact.list_joined:${L2}:${C}`, event_at: AT }]);
    });
    test('Contact Added to List finds nothing for a list that no longer exists', async () => {
      noEvents('contact.list_joined');
      nock(API).get(`${V1}/lists`).reply(200, { lists: [{ id: L, name: 'News' }] });
      await expect(run(App.triggers.new_list_member.operation.performList, { inputData: { list_id: OTHER } })).resolves.toEqual([]);
    });
    test('Tag Added to Contact lists contacts with the first tag when none is chosen', async () => {
      noEvents('contact.tag_added');
      nock(API).get(`${V1}/tags`).reply(200, { tags: [{ id: T, name: 'customer' }, { id: T2, name: 'VIP' }] });
      nock(API).get(`${V1}/contacts`).query({ tag: T, limit: 25 }).reply(200, { contacts: [contact] });
      const out = await run(App.triggers.tag_added.operation.performList, { inputData: {} });
      expect(out).toEqual([{ ...contact, tag: { id: T, name: 'customer' }, event_id: `contact.tag_added:${T}:${C}`, event_at: contact.created_at }]);
    });
    test('Campaign Sent lists sent campaigns in the shape of the event', async () => {
      const sent = { id: CMP, name: 'September', sent_at: AT, stats_sent: 20, stats_delivered: 19, stats_bounced: 1 };
      noEvents('campaign.sent');
      nock(API).get(`${V1}/campaigns`).query({ status: 'sent', limit: 25 }).reply(200, { campaigns: [sent, { ...sent, id: OTHER }], pagination: {} });
      const out = await run(App.triggers.campaign_sent.operation.performList, { inputData: { campaign_id: CMP } });
      expect(out).toEqual([{ campaign_id: CMP, name: 'September', sent_at: AT, recipients: 20, delivered: 19, bounced: 1, event_id: `campaign.sent:${CMP}`, event_at: AT }]);
      const { event_id: _e, event_at: _a, ...fields } = App.triggers.campaign_sent.operation.sample;
      expect(Object.keys(out[0]).sort()).toEqual([...Object.keys(fields), 'event_id', 'event_at'].sort());
    });
    test('the other triggers find nothing until an event is recorded, so the editor offers the sample', async () => {
      const fromWorkspace = ['campaign_sent', 'contact_bounced', 'contact_complained', 'contact_updated', 'new_contact', 'new_list_member', 'new_unsubscribe', 'tag_added'];
      for (const [key, event] of Object.entries(EVENTS).filter(([k]) => !fromWorkspace.includes(k))) {
        noEvents(event);
        await expect(run(App.triggers[key].operation.performList, { inputData: {} })).resolves.toEqual([]);
      }
    });
  });
});

describe('contact actions', () => {
  test('create_contact: a new contact, put on a list and tagged by name', async () => {
    lookup('ada@example.com', []);
    nock(API).post(`${V1}/contacts`, { email: 'ada@example.com', first_name: 'Ada', source: 'zapier' }).reply(201, { contact });
    nock(API).post(`${V1}/lists/${L}/contacts`, { contact_id: C }).reply(201, { membership: 'confirmed' });
    nock(API).get(`${V1}/tags`).reply(200, { tags: [{ id: T, name: 'customer' }] });
    nock(API).post(`${V1}/contacts/${C}/tags`, { tag_id: T }).reply(201, { contact_tag: {} });
    const out = await perform('creates', 'create_contact', { email: 'ada@example.com', first_name: 'Ada', last_name: '', list_id: L, tag: 'Customer', source: '', resubscribe: 'false' });
    expect(out).toEqual({ ...contact, created: true });
  });
  test('create_contact: updates an existing contact, merging custom fields and re-subscribing when asked', async () => {
    const existing = { ...contact, status: 'unsubscribed', custom_fields: { plan: 'starter', seats: 3 } };
    lookup('ada@example.com', [existing]);
    nock(API).patch(`${V1}/contacts/${C}`, { last_name: 'Byron', custom_fields: { plan: 'team', seats: 3 }, resubscribe: true }).reply(200, { contact: { ...existing, status: 'subscribed' } });
    const out = await perform('creates', 'create_contact', { email: ' ADA@example.com', last_name: 'Byron', custom_fields: { plan: 'team' }, resubscribe: 'true' });
    expect(out).toMatchObject({ id: C, status: 'subscribed', created: false });
  });
  test('create_contact: never re-subscribes someone who is still subscribed, and skips an empty update', async () => {
    lookup('ada@example.com', [contact]);
    const out = await perform('creates', 'create_contact', { email: 'ada@example.com', resubscribe: true });
    expect(out).toEqual({ ...contact, created: false });
  });
  test('create_contact: a contact added in the meantime (409) is updated instead', async () => {
    lookup('ada@example.com', []);
    nock(API).post(`${V1}/contacts`).reply(409, { error: 'A contact with this email already exists' });
    lookup('ada@example.com', [contact]);
    nock(API).patch(`${V1}/contacts/${C}`, { first_name: 'Augusta' }).reply(200, { contact: { ...contact, first_name: 'Augusta' } });
    const out = await perform('creates', 'create_contact', { email: 'ada@example.com', first_name: 'Augusta' });
    expect(out).toMatchObject({ first_name: 'Augusta', created: false });
  });
  test('create_contact: passes on SendBeam\'s reason when an address cannot be added', async () => {
    lookup('ada@example.com', []);
    nock(API).post(`${V1}/contacts`).reply(409, { error: 'This address previously bounced and cannot be re-added.' });
    lookup('ada@example.com', []);
    await expect(perform('creates', 'create_contact', { email: 'ada@example.com' })).rejects.toThrow('previously bounced');
  });
  test('create_contact: a 403 explains the missing permission', async () => {
    lookup('ada@example.com', []);
    nock(API).post(`${V1}/contacts`).reply(403, { error: 'Forbidden: contacts:write permission required' });
    await expect(perform('creates', 'create_contact', { email: 'ada@example.com' })).rejects.toThrow(/contacts:write.*API keys/);
  });

  test('update_contact: changes only the fields given, keeping other custom fields', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).patch(`${V1}/contacts/${C}`, { email: 'ada@newmail.example', custom_fields: { plan: 'starter', seats: '4' } }).reply(200, { contact: { ...contact, email: 'ada@newmail.example' } });
    const out = await perform('creates', 'update_contact', { email: 'ada@example.com', new_email: 'ada@newmail.example', first_name: '', custom_fields: { seats: '4' } });
    expect(out.email).toBe('ada@newmail.example');
  });
  test('update_contact: asks for something to change', async () => {
    lookup('ada@example.com', [contact]);
    await expect(perform('creates', 'update_contact', { email: 'ada@example.com', first_name: ' ' })).rejects.toThrow('Fill in at least one field');
  });
  test('update_contact: an unknown email says how to add the contact', async () => {
    lookup('nobody@example.com', [{ ...contact, email: 'nobody@example.community' }]);
    await expect(perform('creates', 'update_contact', { email: 'nobody@example.com', first_name: 'N' })).rejects.toThrow('No contact with the email nobody@example.com in this workspace. To add them, use Create or Update Contact first.');
  });
  test('unsubscribe_contact sets the status', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).patch(`${V1}/contacts/${C}`, { status: 'unsubscribed' }).reply(200, { contact: { ...contact, status: 'unsubscribed' } });
    await expect(perform('creates', 'unsubscribe_contact', { email: 'ada@example.com' })).resolves.toMatchObject({ status: 'unsubscribed' });
  });
  test('delete_contact deletes by id', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).delete(`${V1}/contacts/${C}`).reply(200, { success: true });
    await expect(perform('creates', 'delete_contact', { email: 'ada@example.com' })).resolves.toEqual({ id: C, email: 'ada@example.com', deleted: true });
  });

  test('add_to_list creates the contact when new and reports a pending double opt-in', async () => {
    nock(API).post(`${V1}/contacts`, { email: 'ada@example.com', source: 'zapier' }).reply(201, { contact });
    nock(API).post(`${V1}/lists/${L}/contacts`, { contact_id: C }).reply(201, { list_contact: {}, membership: 'pending_confirmation', double_optin_sent: true, already_member: false });
    await expect(perform('creates', 'add_to_list', { email: 'ada@example.com', list_id: L })).resolves.toEqual({ contact_id: C, email: 'ada@example.com', list_id: L, membership: 'pending_confirmation', double_optin_sent: true, added: true });
  });
  test('add_to_list: an existing member is not an error', async () => {
    nock(API).post(`${V1}/contacts`).reply(409, { error: 'A contact with this email already exists' });
    lookup('ada@example.com', [contact]);
    nock(API).post(`${V1}/lists/${L}/contacts`).reply(409, { error: 'Contact is already in this list' });
    await expect(perform('creates', 'add_to_list', { email: 'ada@example.com', list_id: L })).resolves.toMatchObject({ added: false, membership: 'confirmed' });
  });
  test('remove_from_list sends the contact in the body', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).delete(`${V1}/lists/${L}/contacts`, { contact_id: C }).reply(200, { success: true });
    await expect(perform('creates', 'remove_from_list', { email: 'ada@example.com', list_id: L })).resolves.toEqual({ contact_id: C, email: 'ada@example.com', list_id: L, removed: true });
  });

  test('add_tag creates a tag the workspace does not have yet', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).get(`${V1}/tags`).reply(200, { tags: [{ id: T, name: 'customer' }] });
    nock(API).post(`${V1}/tags`, { name: 'VIP' }).reply(201, { tag: { id: T2, name: 'VIP' } });
    nock(API).post(`${V1}/contacts/${C}/tags`, { tag_id: T2 }).reply(201, { contact_tag: {} });
    await expect(perform('creates', 'add_tag', { email: 'ada@example.com', tag: 'VIP' })).resolves.toEqual({ contact_id: C, email: 'ada@example.com', tag_id: T2, added: true });
  });
  test('add_tag: a tag chosen from the dropdown is used as is, and an existing tag is not an error', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).post(`${V1}/contacts/${C}/tags`, { tag_id: T }).reply(409, { error: 'Contact already has this tag' });
    await expect(perform('creates', 'add_tag', { email: 'ada@example.com', tag: T })).resolves.toMatchObject({ tag_id: T, added: false });
  });
  test('remove_tag finds the tag by name regardless of case', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).get(`${V1}/tags`).reply(200, { tags: [{ id: T, name: 'customer' }] });
    nock(API).delete(`${V1}/contacts/${C}/tags/${T}`).reply(200, { success: true });
    await expect(perform('creates', 'remove_tag', { email: 'ada@example.com', tag: 'CUSTOMER' })).resolves.toEqual({ contact_id: C, email: 'ada@example.com', tag_id: T, removed: true });
  });
  test('remove_tag never creates a tag', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).get(`${V1}/tags`).reply(200, { tags: [] });
    await expect(perform('creates', 'remove_tag', { email: 'ada@example.com', tag: 'Nope' })).rejects.toThrow(/No tag called .{1,2}Nope.{1,2} in this workspace\./);
  });
});

describe('email actions', () => {
  test('send_email posts to /send with merge tags intact and returns SendBeam\'s answer', async () => {
    lookup('ada@example.com', [contact]);
    nock(API)
      .post(`${V1}/send`, (b) => b.contact_id === C && b.subject === 'Hi {{first_name}}' && b.html_content === '<p>Hello {{first_name}}</p>' && !('text_content' in b))
      .reply(200, { ok: true, message_id: 'm-1' });
    const out = await perform('creates', 'send_email', { email: 'ada@example.com', subject: 'Hi {{first_name}}', html_content: '<p>Hello {{first_name}}</p>', text_content: '' });
    expect(out).toEqual({ ok: true, message_id: 'm-1', contact_id: C, email: 'ada@example.com' });
  });
  test('send_email: a 429 becomes a throttled error so Zapier retries later', async () => {
    lookup('ada@example.com', [contact]);
    nock(API).post(`${V1}/send`).reply(429, { error: 'Too many requests' });
    await expect(perform('creates', 'send_email', { email: 'ada@example.com', subject: 's', html_content: 'h' })).rejects.toMatchObject({ name: 'ThrottledError' });
  });
  test('send_transactional sends to several addresses with copies', async () => {
    nock(API)
      .post(`${V1}/transactional`, { to: ['a@example.com', 'b@example.com'], subject: 'Order {{order}}', html: '<p>Thanks</p>', cc: ['c@example.com', 'd@example.com'], from_name: 'Shop', reply_to: 'help@example.com' })
      .reply(200, { ok: true, sent: [{ to: 'a@example.com', message_id: 'm-a' }], failed: [], skipped: [{ to: 'b@example.com', reason: 'suppressed' }] });
    const out = await perform('creates', 'send_transactional', { to: ['a@example.com', ' b@example.com'], cc: 'c@example.com, d@example.com', bcc: '', subject: 'Order {{order}}', html: '<p>Thanks</p>', from_name: 'Shop', reply_to: 'help@example.com', from_email: '' });
    expect(out).toMatchObject({ ok: true, message_id: 'm-a', sent_count: 1, failed_count: 0, skipped_count: 1 });
  });
  test('send_transactional: one address is sent as a string, and none is refused', async () => {
    nock(API).post(`${V1}/transactional`, { to: 'a@example.com', subject: 'S', html: 'H', text: 'T' }).reply(200, { ok: true, sent: [{ to: 'a@example.com', message_id: 'm-a' }], failed: [], skipped: [] });
    await expect(perform('creates', 'send_transactional', { to: 'a@example.com', subject: 'S', html: 'H', text: 'T' })).resolves.toMatchObject({ sent_count: 1 });
    await expect(perform('creates', 'send_transactional', { to: ' ', subject: 'S', html: 'H' })).rejects.toThrow('Add at least one recipient.');
  });
});

describe('campaign actions', () => {
  test('create_campaign for a list', async () => {
    nock(API)
      .post(`${V1}/campaigns`, { name: 'September', subject: 'Hi {{first_name}}', from_email: 'news@example.com', html_content: '<p>x</p>', send_to_type: 'list', send_to_id: L, from_name: 'Ada' })
      .reply(201, { campaign: { id: CMP, status: 'draft' } });
    await expect(perform('creates', 'create_campaign', { name: 'September', subject: 'Hi {{first_name}}', from_email: 'news@example.com', from_name: 'Ada', html_content: '<p>x</p>', send_to_type: 'list', list_id: L, segment_id: '' })).resolves.toEqual({ id: CMP, status: 'draft' });
  });
  test('create_campaign for everyone sends no audience id, and a list audience needs a list', async () => {
    nock(API).post(`${V1}/campaigns`, { name: 'N', subject: 'S', from_email: 'news@example.com', html_content: 'H', send_to_type: 'all' }).reply(201, { campaign: { id: CMP } });
    await perform('creates', 'create_campaign', { name: 'N', subject: 'S', from_email: 'news@example.com', html_content: 'H', send_to_type: 'all', list_id: L });
    await expect(perform('creates', 'create_campaign', { name: 'N', subject: 'S', from_email: 'news@example.com', html_content: 'H', send_to_type: 'segment' })).rejects.toThrow('Choose the segment to send to.');
  });
  test('send_campaign schedules with an ISO time', async () => {
    nock(API).post(`${V1}/campaigns/${CMP}/send`, { scheduled_at: '2030-01-01T08:00:00.000Z' }).reply(200, { id: CMP, status: 'scheduled', scheduled_at: '2030-01-01T08:00:00.000Z' });
    await expect(perform('creates', 'send_campaign', { campaign_id: CMP, scheduled_at: '2030-01-01T09:00:00+01:00' })).resolves.toEqual({ id: CMP, status: 'scheduled', scheduled_at: '2030-01-01T08:00:00.000Z', queued: null });
  });
  test('send_campaign now', async () => {
    nock(API).post(`${V1}/campaigns/${CMP}/send`, {}).reply(202, { id: CMP, status: 'sending', queued: 12 });
    await expect(perform('creates', 'send_campaign', { campaign_id: CMP, scheduled_at: '' })).resolves.toEqual({ id: CMP, status: 'sending', scheduled_at: null, queued: 12 });
  });
  test('duplicate_campaign to the people who did not open it', async () => {
    nock(API).post(`${V1}/campaigns/${CMP}/duplicate`, { audience: 'non_openers' }).reply(201, { campaign: { id: OTHER, name: 'September (copy)' } });
    await expect(perform('creates', 'duplicate_campaign', { campaign_id: CMP, non_openers: 'true' })).resolves.toEqual({ id: OTHER, name: 'September (copy)' });
  });
  test('delete_campaign, and SendBeam\'s reason when it cannot', async () => {
    nock(API).delete(`${V1}/campaigns/${CMP}`).reply(204);
    await expect(perform('creates', 'delete_campaign', { campaign_id: CMP })).resolves.toEqual({ id: CMP, deleted: true });
    nock(API).delete(`${V1}/campaigns/${CMP}`).reply(409, { error: 'Only draft or cancelled campaigns can be deleted; this one is sent.' });
    await expect(perform('creates', 'delete_campaign', { campaign_id: CMP })).rejects.toThrow('Only draft or cancelled campaigns');
  });
});

describe('workspace actions', () => {
  test('start_automation enrols by email', async () => {
    nock(API).post(`${V1}/automations/${A}/trigger`, { email: 'ada@example.com' }).reply(202, { enrolled: true, automation_id: A, contact_id: C });
    await expect(perform('creates', 'start_automation', { automation_id: A, email: ' ada@example.com' })).resolves.toEqual({ enrolled: true, automation_id: A, contact_id: C });
  });
  test('start_automation: a refusal halts the step with SendBeam\'s reason', async () => {
    nock(API).post(`${V1}/automations/${A}/trigger`).reply(409, { enrolled: false, reason: 'The contact is already in this automation.' });
    await expect(perform('creates', 'start_automation', { automation_id: A, email: 'ada@example.com' })).rejects.toMatchObject({ name: 'HaltedError', message: expect.stringContaining('already in this automation') });
  });
  test('create_list', async () => {
    nock(API).post(`${V1}/lists`, { name: 'News', description: 'Monthly', double_optin: false }).reply(201, { list: { id: L, name: 'News' } });
    await expect(perform('creates', 'create_list', { name: 'News', description: 'Monthly', double_optin: 'false' })).resolves.toEqual({ id: L, name: 'News' });
    nock(API).post(`${V1}/lists`, { name: 'Offers' }).reply(201, { list: { id: L2, name: 'Offers' } });
    await perform('creates', 'create_list', { name: 'Offers', description: '' });
  });
  test('create_tag', async () => {
    nock(API).post(`${V1}/tags`, { name: 'VIP', color: '#000000' }).reply(201, { tag: { id: T2, name: 'VIP', color: '#000000' } });
    await expect(perform('creates', 'create_tag', { name: 'VIP', color: '#000000' })).resolves.toMatchObject({ id: T2 });
  });
});

describe('searches', () => {
  test('find_contact matches the email exactly, across pages', async () => {
    nock(API).get(`${V1}/contacts`).query({ q: 'ada@example.com', page: 1, limit: 100 }).reply(200, { contacts: [{ ...contact, id: OTHER, email: 'ada@example.community' }], pagination: { page: 1, limit: 100, total: 2, total_pages: 2 } });
    nock(API).get(`${V1}/contacts`).query({ q: 'ada@example.com', page: 2, limit: 100 }).reply(200, { contacts: [contact], pagination: { page: 2, limit: 100, total: 2, total_pages: 2 } });
    await expect(perform('searches', 'find_contact', { email: 'Ada@Example.com' })).resolves.toEqual([contact]);
  });
  test('find_contact finds nothing', async () => {
    lookup('nobody@example.com', []);
    await expect(perform('searches', 'find_contact', { email: 'nobody@example.com' })).resolves.toEqual([]);
  });
  test('find_list matches the name regardless of case', async () => {
    nock(API).get(`${V1}/lists`).reply(200, { lists: [{ id: L, name: ' Product Updates ' }, { id: L2, name: 'Product updates weekly' }] });
    await expect(perform('searches', 'find_list', { name: 'product updates' })).resolves.toEqual([{ id: L, name: ' Product Updates ' }]);
  });
  test('find_tag', async () => {
    nock(API).get(`${V1}/tags`).reply(200, { tags: [{ id: T, name: 'customer' }] });
    await expect(perform('searches', 'find_tag', { name: 'Customer' })).resolves.toEqual([{ id: T, name: 'customer' }]);
  });
  test('find_campaign by name and status', async () => {
    nock(API).get(`${V1}/campaigns`).query({ status: 'sent', page: 1, limit: 100 }).reply(200, { campaigns: [{ id: CMP, name: 'September' }, { id: OTHER, name: 'October' }], pagination: { page: 1, limit: 100, total: 2, total_pages: 1 } });
    await expect(perform('searches', 'find_campaign', { name: 'september', status: 'sent' })).resolves.toEqual([{ id: CMP, name: 'September' }]);
  });
  test('get_campaign_report, and nothing for a campaign that does not exist', async () => {
    const report = { campaign_id: CMP, opens: 3, clicks: 1, links: [], clients: [], devices: [] };
    nock(API).get(`${V1}/campaigns/${CMP}/report`).reply(200, report);
    await expect(perform('searches', 'get_campaign_report', { campaign_id: CMP })).resolves.toEqual([{ id: CMP, ...report }]);
    nock(API).get(`${V1}/campaigns/${OTHER}/report`).reply(404, { error: 'Campaign not found' });
    await expect(perform('searches', 'get_campaign_report', { campaign_id: OTHER })).resolves.toEqual([]);
  });
});

describe('dropdowns', () => {
  test.each([
    ['list', '/lists', 'lists'],
    ['tag', '/tags', 'tags'],
    ['form', '/forms', 'forms'],
    ['segment', '/segments', 'segments'],
    ['automation', '/automations', 'automations'],
  ])('%s', async (key, url, collection) => {
    nock(API).get(`${V1}${url}`).reply(200, { [collection]: [{ id: 'x-1', name: 'One', extra: true }] });
    await expect(run(App.resources[key].list.operation.perform)).resolves.toEqual([{ id: 'x-1', name: 'One' }]);
  });
  test('campaign, paged', async () => {
    nock(API).get(`${V1}/campaigns`).query({ page: 1, limit: 100 }).reply(200, { campaigns: [{ id: CMP, name: 'September', status: 'sent' }], pagination: { page: 1, limit: 100, total: 1, total_pages: 1 } });
    await expect(run(App.resources.campaign.list.operation.perform)).resolves.toEqual([{ id: CMP, name: 'September' }]);
  });
});
