'use strict';

/**
 * Sample data for the Zap editor. Every shape here is what SendBeam really
 * sends in a webhook (after the contact is flattened) or returns from the
 * API, as described at https://sendbeam.io/openapi.json. Change them together.
 */

const IDS = {
  contact: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10',
  list: '9c2b1a0f-1111-4222-8333-444455556666',
  tag: '5d6e7f80-2222-4333-8444-555566667777',
  form: '8f3c1a2e-3b1d-4c55-9a0e-1f2d3c4b5a69',
  campaign: '2f9c1b1e-3f9e-4a3b-9c2f-1d1e2f3a4b5c',
  send: 'c0ffee00-1111-4222-8333-444455556666',
  submission: 'b1d2c3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  workspace: '1a2b3c4d-5555-4666-8777-888899990000',
  automation: 'f6e5d4c3-b2a1-4f0e-9d8c-7b6a5f4e3d2c',
  segment: '4b5c6d7e-6666-4777-8888-9999aaaabbbb',
};
const AT = '2026-09-05T09:12:00.000Z';
const EVENT_AT = '2026-09-05T09:12:04.000Z';

const eventOutputFields = [
  { key: 'event_id', label: 'Event ID' },
  { key: 'event_at', label: 'Event Time', type: 'datetime' },
];
const withEvent = (sample, eventId) => ({ ...sample, event_id: eventId, event_at: EVENT_AT });

// ── Webhook shapes ─────────────────────────────────────────────────────────

/** The contact in a contact event (`data.contact`), tags as names. */
const sampleContact = {
  id: IDS.contact,
  email: 'ada@example.com',
  status: 'subscribed',
  first_name: 'Ada',
  last_name: 'Lovelace',
  source: 'api',
  custom_fields: { plan: 'starter' },
  created_at: AT,
  subscribed_at: AT,
  unsubscribed_at: null,
  tags: ['customer'],
};

const contactOutputFields = [
  { key: 'id', label: 'Contact ID' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'source', label: 'Source' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
  { key: 'subscribed_at', label: 'Subscribed At', type: 'datetime' },
  { key: 'unsubscribed_at', label: 'Unsubscribed At', type: 'datetime' },
  { key: 'tags', label: 'Tags', list: true },
];

/** An email event (sends, delivery reports, opens and clicks). */
const sampleSend = {
  send_id: IDS.send,
  message_id: 'msg_5f8b2c0a9d1e',
  email: 'ada@example.com',
  contact_id: IDS.contact,
  campaign_id: IDS.campaign,
  subject: 'What shipped in September',
};

const sendOutputFields = [
  { key: 'send_id', label: 'Send ID' },
  { key: 'message_id', label: 'Message ID' },
  { key: 'email', label: 'Email' },
  { key: 'contact_id', label: 'Contact ID' },
  { key: 'campaign_id', label: 'Campaign ID' },
  { key: 'subject', label: 'Subject' },
];

// ── API shapes ─────────────────────────────────────────────────────────────

/** A contact as the contacts API returns it. */
const apiContact = {
  id: IDS.contact,
  tenant_id: IDS.workspace,
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  status: 'subscribed',
  custom_fields: { plan: 'starter' },
  source: 'zapier',
  subscribed_at: AT,
  unsubscribed_at: null,
  created_at: AT,
};

const apiContactOutputFields = [
  { key: 'id', label: 'Contact ID' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'source', label: 'Source' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
  { key: 'subscribed_at', label: 'Subscribed At', type: 'datetime' },
  { key: 'unsubscribed_at', label: 'Unsubscribed At', type: 'datetime' },
];

const sampleList = { id: IDS.list, tenant_id: IDS.workspace, name: 'Product updates', description: 'News about the product, once a month', double_optin: true, created_at: AT };
const listOutputFields = [
  { key: 'id', label: 'List ID' },
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'double_optin', label: 'Double Opt-In', type: 'boolean' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
];

const sampleTag = { id: IDS.tag, tenant_id: IDS.workspace, name: 'customer', color: '#6B7280', created_at: AT };
const tagOutputFields = [
  { key: 'id', label: 'Tag ID' },
  { key: 'name', label: 'Name' },
  { key: 'color', label: 'Colour' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
];

const sampleCampaign = {
  id: IDS.campaign,
  tenant_id: IDS.workspace,
  name: 'September newsletter',
  subject: 'What shipped in September',
  from_name: 'Ada at Example',
  from_email: 'news@example.com',
  html_content: '<p>Hi {{first_name}}, here is what shipped this month.</p>',
  text_content: 'Hi {{first_name}}, here is what shipped this month.',
  status: 'draft',
  send_to_type: 'list',
  send_to_id: IDS.list,
  scheduled_at: null,
  sent_at: null,
  stats_sent: 0,
  stats_delivered: 0,
  stats_opened: 0,
  stats_clicked: 0,
  stats_bounced: 0,
  stats_unsubscribed: 0,
  created_at: AT,
};
const campaignOutputFields = [
  { key: 'id', label: 'Campaign ID' },
  { key: 'name', label: 'Name' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  { key: 'from_name', label: 'From Name' },
  { key: 'from_email', label: 'From Email' },
  { key: 'send_to_type', label: 'Audience' },
  { key: 'send_to_id', label: 'List or Segment ID' },
  { key: 'scheduled_at', label: 'Scheduled At', type: 'datetime' },
  { key: 'sent_at', label: 'Sent At', type: 'datetime' },
  { key: 'stats_sent', label: 'Sent', type: 'integer' },
  { key: 'stats_delivered', label: 'Delivered', type: 'integer' },
  { key: 'stats_opened', label: 'Opened', type: 'integer' },
  { key: 'stats_clicked', label: 'Clicked', type: 'integer' },
  { key: 'stats_bounced', label: 'Bounced', type: 'integer' },
  { key: 'stats_unsubscribed', label: 'Unsubscribed', type: 'integer' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
];

const sampleReport = {
  campaign_id: IDS.campaign,
  opens: 184,
  clicks: 41,
  links: [{ url: 'https://example.com/post', clicks: 41, unique: 33 }],
  clients: [{ name: 'Gmail', count: 120 }, { name: 'Apple Mail', count: 64 }],
  devices: [{ name: 'Mobile', count: 50 }, { name: 'Desktop', count: 14 }],
};

module.exports = {
  IDS,
  AT,
  EVENT_AT,
  withEvent,
  eventOutputFields,
  sampleContact,
  contactOutputFields,
  sampleSend,
  sendOutputFields,
  apiContact,
  apiContactOutputFields,
  sampleList,
  listOutputFields,
  sampleTag,
  tagOutputFields,
  sampleCampaign,
  campaignOutputFields,
  sampleReport,
};
