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

/** One event as a Zap receives it, whether it arrived as a delivery or was read back from recent events. */
const toItem = (event, body) => {
  const data = flatten(body.data);
  // The delivery id is stable across SendBeam's retries, so Zapier dedupes on it.
  const fallback = data.id || data.send_id || data.submission_id || data.campaign_id || '';
  return { ...data, event_id: body.id || `${event}:${fallback}:${body.created_at || ''}`, event_at: body.created_at || null };
};

/**
 * `filter` narrows a trigger to one list, tag, campaign or form:
 * `{ key, label, dynamic, helpText, dimension, valueOf }`. The choice is sent
 * to SendBeam as the endpoint's filter, so other events never leave SendBeam,
 * and checked again here in case a delivery arrives from before a change.
 *
 * `fallback` lists records the workspace already holds, in the shape of the
 * event, for testing the trigger before any event of its type is recorded.
 */
const makeHookTrigger = ({ key, noun, label, description, event, sample, outputFields, filter, fallback, hidden }) => {
  // SendBeam IDs are lowercase UUIDs; a pasted ID may not be.
  const chosen = (bundle) => (filter ? String((bundle.inputData || {})[filter.key] || '').trim().toLowerCase() : '');
  const wanted = (bundle, item) => {
    const id = chosen(bundle);
    return !id || String(filter.valueOf(item) || '').toLowerCase() === id;
  };
  const inputFields = filter
    ? [{ key: filter.key, label: filter.label, required: false, dynamic: filter.dynamic, helpText: filter.helpText }]
    : [];

  return {
    key,
    noun,
    display: hidden ? { label, description, hidden: true } : { label, description },
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
        const item = toItem(event, body);
        return wanted(bundle, item) ? [item] : [];
      },
      /**
       * Testing the trigger: the workspace's latest real events of this type,
       * as they were delivered to its webhooks, mapped exactly as perform maps
       * a delivery. With none recorded yet the fallback, if there is one, lists
       * workspace records; otherwise nothing, and the editor offers the sample.
       */
      performList: async (z, bundle) => {
        const response = await z.request({ url: `${BASE_URL}/events`, params: { type: event, limit: 25 }, skipThrowForStatus: true });
        // A key with webhooks:write but not webhooks:read runs the trigger fine; it only cannot read past events.
        if (response.status !== 403) {
          check(z, response, 'Loading recent events');
          const items = (response.data.events || [])
            .filter((e) => !e.event || e.event === event)
            .map((e) => toItem(event, e))
            .filter((item) => wanted(bundle, item));
          if (items.length > 0) return items;
        }
        return fallback ? fallback(z, bundle) : [];
      },
      sample,
      outputFields,
    },
  };
};

module.exports = { makeHookTrigger, flatten };
