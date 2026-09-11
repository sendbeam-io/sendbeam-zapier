'use strict';

/**
 * Checks the app against SendBeam's published API description, so a renamed
 * field or path on either side fails here instead of in someone's Zap.
 *
 * Every action, search, trigger and dropdown runs against a stand-in that
 * answers anything; each request it makes must be a documented method and
 * path, with only documented body fields and query parameters. Adding an
 * action or search without a scenario here fails too. Needs network access to
 * https://sendbeam.io/openapi.json.
 */

const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { EVENTS } = require('../src/triggers');

const appTester = zapier.createAppTester(App);
const SPEC_URL = process.env.SENDBEAM_OPENAPI_URL || 'https://sendbeam.io/openapi.json';
const API = 'https://sendbeam.io';
const authData = { api_key: 'sb_live_ab12cd34_notarealsecret' };

const ID = {
  contact: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10',
  list: '9c2b1a0f-1111-4222-8333-444455556666',
  tag: '5d6e7f80-2222-4333-8444-555566667777',
  campaign: '2f9c1b1e-3f9e-4a3b-9c2f-1d1e2f3a4b5c',
  segment: '4b5c6d7e-6666-4777-8888-9999aaaabbbb',
  automation: 'f6e5d4c3-b2a1-4f0e-9d8c-7b6a5f4e3d2c',
};

const scenarios = [
  // Finds the existing (unsubscribed) contact: covers the update path.
  {
    type: 'creates', key: 'create_contact',
    inputData: { email: 'jo@example.com', first_name: 'Jo', last_name: 'B', custom_fields: { k: 'v' }, list_id: ID.list, tag: 'Customer', resubscribe: true },
  },
  // No such contact: covers the create path, and a tag that does not exist yet.
  {
    type: 'creates', key: 'create_contact',
    inputData: { email: 'new@example.com', first_name: 'N', last_name: 'B', custom_fields: { k: 'v' }, source: 'web', resubscribe: true, list_id: ID.list, tag: 'Brand new' },
  },
  { type: 'creates', key: 'update_contact', inputData: { email: 'jo@example.com', new_email: 'jo2@example.com', first_name: 'J', last_name: 'B', custom_fields: { k: 'v' } } },
  { type: 'creates', key: 'unsubscribe_contact', inputData: { email: 'jo@example.com' } },
  { type: 'creates', key: 'delete_contact', inputData: { email: 'jo@example.com' } },
  { type: 'creates', key: 'add_to_list', inputData: { email: 'jo@example.com', list_id: ID.list } },
  { type: 'creates', key: 'remove_from_list', inputData: { email: 'jo@example.com', list_id: ID.list } },
  { type: 'creates', key: 'add_tag', inputData: { email: 'jo@example.com', tag: 'Brand new' } },
  { type: 'creates', key: 'remove_tag', inputData: { email: 'jo@example.com', tag: 'Customer' } },
  { type: 'creates', key: 'send_email', inputData: { email: 'jo@example.com', subject: 'S', html_content: '<p>x</p>', text_content: 'x' } },
  {
    type: 'creates', key: 'send_transactional',
    inputData: { to: ['a@example.com', 'b@example.com'], subject: 'S', html: '<p>x</p>', text: 'x', cc: ['c@example.com'], bcc: ['d@example.com'], from_email: 'o@example.com', from_name: 'O', reply_to: 'r@example.com' },
  },
  {
    type: 'creates', key: 'create_campaign',
    inputData: { name: 'N', subject: 'S', from_email: 'news@example.com', from_name: 'A', html_content: '<p>x</p>', text_content: 'x', send_to_type: 'list', list_id: ID.list },
  },
  {
    type: 'creates', key: 'create_campaign',
    inputData: { name: 'N', subject: 'S', from_email: 'news@example.com', html_content: '<p>x</p>', send_to_type: 'segment', segment_id: ID.segment },
  },
  { type: 'creates', key: 'send_campaign', inputData: { campaign_id: ID.campaign, scheduled_at: '2030-01-01T09:00:00Z' } },
  { type: 'creates', key: 'duplicate_campaign', inputData: { campaign_id: ID.campaign, non_openers: true } },
  { type: 'creates', key: 'delete_campaign', inputData: { campaign_id: ID.campaign } },
  { type: 'creates', key: 'start_automation', inputData: { automation_id: ID.automation, email: 'jo@example.com' } },
  { type: 'creates', key: 'create_list', inputData: { name: 'News', description: 'd', double_optin: true } },
  { type: 'creates', key: 'create_tag', inputData: { name: 'VIP', color: '#000000' } },
  { type: 'searches', key: 'find_contact', inputData: { email: 'jo@example.com' } },
  { type: 'searches', key: 'find_list', inputData: { name: 'News' } },
  { type: 'searches', key: 'find_tag', inputData: { name: 'Customer' } },
  { type: 'searches', key: 'find_campaign', inputData: { name: 'September', status: 'sent' } },
  { type: 'searches', key: 'get_campaign_report', inputData: { campaign_id: ID.campaign } },
  ...Object.keys(App.resources).map((key) => ({ type: 'resources', key })),
  // Each trigger subscribes with its filter set (when it has one), unsubscribes,
  // and loads sample data: recent events, then (as there are none here) its
  // fallback listing, if it has one.
  ...Object.entries(App.triggers).flatMap(([key, trigger]) => {
    const inputData = Object.fromEntries(trigger.operation.inputFields.map((f) => [f.key, ID[f.key.replace(/_id$/, '')]]));
    return [
      { type: 'triggers', key, method: 'performSubscribe', inputData },
      { type: 'triggers', key, method: 'performUnsubscribe' },
      { type: 'triggers', key, method: 'performList', inputData },
    ];
  }),
];

/** Answers any request with something plausible enough for the app to carry on. */
const anything = ({ method, path }) => {
  const page = { page: 1, limit: 100, total: 1, total_pages: 1 };
  const person = { id: ID.contact, email: 'jo@example.com', status: 'unsubscribed', custom_fields: {}, created_at: '2026-09-05T09:12:00.000Z' };
  if (method === 'GET') {
    if (path === '/events') return { events: [] };
    if (path === '/contacts' || /^\/lists\/[^/]+\/contacts$/.test(path)) return { contacts: [person], pagination: page };
    if (path === '/tags') return { tags: [{ id: ID.tag, name: 'Customer' }] };
    if (path === '/lists') return { lists: [{ id: ID.list, name: 'News' }] };
    if (path === '/campaigns') return { campaigns: [{ id: ID.campaign, name: 'September' }], pagination: page };
    if (/^\/(segments|forms|automations)$/.test(path)) return { [path.slice(1)]: [{ id: ID.segment, name: 'One' }] };
    if (/\/report$/.test(path)) return { campaign_id: ID.campaign, links: [], clients: [], devices: [], opens: 0, clicks: 0 };
  }
  return {
    id: 'x-1', ok: true, message_id: 'm-1', enrolled: true, sent: [], failed: [], skipped: [],
    contact: person, campaign: { id: ID.campaign }, list: { id: ID.list }, tag: { id: ID.tag },
  };
};

let spec;
let calls = [];

beforeAll(async () => {
  // Fetched before any interceptor exists, with Node's own fetch, which nock
  // does not intercept.
  const response = await fetch(SPEC_URL);
  if (!response.ok) throw new Error(`could not fetch ${SPEC_URL}: HTTP ${response.status}`);
  spec = await response.json();

  for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
    nock(API).persist().intercept(/^\/api\/v1\//, method).query(true).reply(function reply(uri, body) {
      const url = new URL(uri, API);
      const call = {
        method,
        path: url.pathname.replace(/^\/api\/v1/, ''),
        query: Object.fromEntries(url.searchParams),
        body: typeof body === 'string' ? (body ? JSON.parse(body) : {}) : body || {},
      };
      calls.push(call);
      return [method === 'POST' ? 201 : 200, anything(call)];
    });
  }
}, 30000);

afterAll(() => nock.cleanAll());

const resolve = (node) => (node && node.$ref ? node.$ref.split('/').slice(1).reduce((n, key) => n[key], spec) : node);

const documented = (method, path) => {
  const full = `/api/v1${path}`;
  for (const [template, operations] of Object.entries(spec.paths)) {
    const re = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    const operation = operations[method.toLowerCase()];
    if (operation && re.test(full)) return { template, operation };
  }
  return undefined;
};

/** Body fields the description does not name, one level into documented objects (such as webhook filters). */
const undocumentedFields = (body, schema, prefix = '') => {
  const resolved = resolve(schema);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  if (!resolved || !resolved.properties) return resolved && resolved.additionalProperties ? [] : Object.keys(body).map((k) => prefix + k);
  return Object.entries(body).flatMap(([field, value]) => {
    if (!(field in resolved.properties)) return [prefix + field];
    const child = resolve(resolved.properties[field]);
    return child && child.properties && !prefix ? undocumentedFields(value, child, `${field}.`) : [];
  });
};

const label = (s) => `${s.type} → ${s.key}${s.method ? ` (${s.method})` : ''}`;

describe('against the published SendBeam API', () => {
  test('every action and search has a scenario here', () => {
    const covered = new Set(scenarios.map((s) => `${s.type}/${s.key}`));
    const all = [
      ...Object.keys(App.creates).map((k) => `creates/${k}`),
      ...Object.keys(App.searches).map((k) => `searches/${k}`),
      ...Object.keys(App.resources).map((k) => `resources/${k}`),
      ...Object.keys(App.triggers).map((k) => `triggers/${k}`),
    ];
    expect(all.filter((k) => !covered.has(k))).toEqual([]);
  });

  test.each(scenarios.map((s) => [label(s), s]))('%s only uses documented requests', async (_name, scenario) => {
    calls = [];
    const definition = scenario.type === 'resources' ? App.resources[scenario.key].list : App[scenario.type][scenario.key];
    await appTester(definition.operation[scenario.method || 'perform'], {
      authData,
      inputData: scenario.inputData || {},
      targetUrl: 'https://hooks.zapier.com/hooks/standard/1/abc/',
      subscribeData: { id: 'wh-1' },
    });
    expect(calls.length).toBeGreaterThan(0);

    const problems = [];
    for (const call of calls) {
      const match = documented(call.method, call.path);
      if (!match) {
        problems.push(`${call.method} /api/v1${call.path} is not in the API description`);
        continue;
      }
      const where = `${call.method} ${match.template}`;
      const content = match.operation.requestBody && match.operation.requestBody.content;
      const schema = content && content['application/json'] && content['application/json'].schema;
      for (const field of undocumentedFields(call.body, schema || { properties: {} })) problems.push(`${where} does not document body field "${field}"`);

      const query = (match.operation.parameters || [])
        .concat(spec.paths[match.template].parameters || [])
        .map(resolve)
        .filter((p) => p.in === 'query')
        .map((p) => p.name);
      for (const name of Object.keys(call.query)) {
        if (!query.includes(name)) problems.push(`${where} does not document query parameter "${name}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  // The sending-domain events are left to SendBeam's own webhooks.
  const triggerEvents = () => spec.components.schemas.WebhookEvent.enum.filter((e) => !e.startsWith('domain.')).sort();

  test('the triggers cover every event SendBeam sends, apart from the sending-domain ones', () => {
    expect(Object.values(EVENTS).sort()).toEqual(triggerEvents());
  });

  test('recent events can be read for every trigger, in the shape a delivery arrives in', () => {
    const { operation } = documented('GET', '/events');
    const params = operation.parameters.map(resolve);
    const type = params.find((p) => p.name === 'type');
    expect(type.required).toBe(true);
    expect(resolve(type.schema).enum).toEqual(expect.arrayContaining(Object.values(EVENTS)));
    expect(params.find((p) => p.name === 'limit').schema.maximum).toBeGreaterThanOrEqual(25);
    const item = resolve(operation.responses['200']).content['application/json'].schema.properties.events.items;
    expect(Object.keys(item.properties).sort()).toEqual(['created_at', 'data', 'event', 'id']);
  });

  test('trigger subscriptions send each event name SendBeam knows', async () => {
    const sent = [];
    for (const trigger of Object.values(App.triggers)) {
      calls = [];
      await appTester(trigger.operation.performSubscribe, { authData, inputData: {}, targetUrl: 'https://hooks.zapier.com/hooks/standard/1/abc/' });
      sent.push(...calls[0].body.event_types);
    }
    expect(sent.sort()).toEqual(triggerEvents());
  });
});
