'use strict';

/**
 * One factory for every webhook-backed trigger. Subscribing creates a
 * SendBeam webhook endpoint pointed at Zapier's URL for the chosen event;
 * unsubscribing deletes it. The delivery body is
 * `{ id, event, created_at, data }`. Contact events carry the person under
 * `data.contact`, with `data.list` or `data.tag` beside it on membership
 * events; a form submission's fields sit directly in `data`.
 */

/**
 * The fields a Zap maps, flat, the same shape as the sample data and
 * performList: the contact's own fields at the top, `list` / `tag` kept.
 */
const flatten = (data) => {
  if (!data || typeof data.contact !== 'object' || data.contact === null) return data || {};
  const { contact, ...rest } = data;
  return { ...contact, ...rest };
};

const { BASE_URL, check } = require('../api');

const sampleContact = {
  id: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10',
  email: 'ada@example.com',
  status: 'subscribed',
  first_name: 'Ada',
  last_name: 'Lovelace',
  source: 'api',
  custom_fields: { plan: 'starter' },
  created_at: '2026-09-05T09:12:00.000Z',
  subscribed_at: '2026-09-05T09:12:00.000Z',
  unsubscribed_at: null,
  tags: ['customer'],
};

const contactOutputFields = [
  { key: 'id', label: 'Contact ID' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'source', label: 'Source' },
  { key: 'created_at', label: 'Created at', type: 'datetime' },
  { key: 'subscribed_at', label: 'Subscribed at', type: 'datetime' },
  { key: 'unsubscribed_at', label: 'Unsubscribed at', type: 'datetime' },
  { key: 'tags', label: 'Tags', list: true },
  { key: 'event_id', label: 'Event ID' },
  { key: 'event_at', label: 'Event time', type: 'datetime' },
];

const makeHookTrigger = ({ key, noun, label, description, event, sample, outputFields, inputFields = [], keep = () => true, performList }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    type: 'hook',
    inputFields,
    performSubscribe: async (z, bundle) => {
      const response = await z.request({
        method: 'POST',
        url: `${BASE_URL}/webhooks`,
        body: { url: bundle.targetUrl, event_types: [event], description: `Zapier: ${label}` },
        skipThrowForStatus: true,
      });
      check(z, response, 'Creating the webhook');
      const created = response.data.webhook || response.data;
      return { id: created.id };
    },
    performUnsubscribe: async (z, bundle) => {
      const id = bundle.subscribeData && bundle.subscribeData.id;
      if (!id) return { ok: true };
      const response = await z.request({ method: 'DELETE', url: `${BASE_URL}/webhooks/${id}`, skipThrowForStatus: true });
      if (response.status !== 404) check(z, response, 'Removing the webhook');
      return { ok: true };
    },
    perform: (z, bundle) => {
      const body = bundle.cleanedRequest || {};
      if (body.event && body.event !== event) return [];
      const data = flatten(body.data);
      if (!keep(data, bundle)) return [];
      // The delivery id is stable across SendBeam's retries, so Zapier dedupes on it.
      return [{ ...data, event_id: body.id || `${event}:${data.id || ''}:${body.created_at || ''}`, event_at: body.created_at || null }];
    },
    performList,
    sample,
    outputFields,
  },
});

module.exports = { makeHookTrigger, sampleContact, contactOutputFields };
