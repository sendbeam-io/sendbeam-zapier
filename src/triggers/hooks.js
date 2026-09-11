'use strict';

/**
 * One factory for every webhook-backed trigger. Subscribing creates a
 * SendBeam webhook endpoint pointed at Zapier's URL for the chosen event;
 * unsubscribing deletes it. The delivery body is
 * `{ id, event, created_at, data }`. Contact events carry the person under
 * `data.contact`, with `data.list` or `data.tag` beside it on membership
 * events; every other event's fields sit directly in `data`.
 */

const { BASE_URL, check } = require('../api');

/**
 * The fields a Zap maps, flat, the same shape as the sample data and
 * performList: the contact's own fields at the top, `list` / `tag` kept.
 */
const flatten = (data) => {
  if (!data || typeof data.contact !== 'object' || data.contact === null) return data || {};
  const { contact, ...rest } = data;
  return { ...contact, ...rest };
};

/**
 * For events SendBeam's API cannot list after the fact (an email opened, a
 * contact deleted), testing the trigger finds nothing and the Zap editor
 * offers the sample instead of presenting unrelated records as the event.
 */
const nothingToList = async () => [];

/**
 * `filter` narrows a trigger to one list, tag, campaign or form:
 * `{ key, label, dynamic, helpText, dimension, valueOf }`. The choice is sent
 * to SendBeam as the endpoint's filter, so other events never leave SendBeam,
 * and checked again here in case a delivery arrives from before a change.
 */
const makeHookTrigger = ({ key, noun, label, description, event, sample, outputFields, filter, performList }) => {
  // SendBeam IDs are lowercase UUIDs; a pasted ID may not be.
  const chosen = (bundle) => (filter ? String((bundle.inputData || {})[filter.key] || '').trim().toLowerCase() : '');
  const inputFields = filter
    ? [{ key: filter.key, label: filter.label, required: false, dynamic: filter.dynamic, helpText: filter.helpText }]
    : [];

  return {
    key,
    noun,
    display: { label, description },
    operation: {
      type: 'hook',
      inputFields,
      performSubscribe: async (z, bundle) => {
        const body = { url: bundle.targetUrl, event_types: [event], description: `Zapier: ${label}` };
        const id = chosen(bundle);
        if (id) body.filters = { [filter.dimension]: [id] };
        const response = await z.request({ method: 'POST', url: `${BASE_URL}/webhooks`, body, skipThrowForStatus: true });
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
        const id = chosen(bundle);
        if (id && String(filter.valueOf(data) || '').toLowerCase() !== id) return [];
        // The delivery id is stable across SendBeam's retries, so Zapier dedupes on it.
        const fallback = data.id || data.send_id || data.submission_id || data.campaign_id || data.domain_id || '';
        return [{ ...data, event_id: body.id || `${event}:${fallback}:${body.created_at || ''}`, event_at: body.created_at || null }];
      },
      performList: performList || nothingToList,
      sample,
      outputFields,
    },
  };
};

module.exports = { makeHookTrigger, flatten, nothingToList };
