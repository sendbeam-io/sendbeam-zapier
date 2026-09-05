'use strict';

const { BASE_URL, check } = require('../api');
const { makeHookTrigger, sampleContact, contactOutputFields } = require('./hooks');

const performList = async (z) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { limit: 25, status: 'unsubscribed' }, skipThrowForStatus: true });
  check(z, response, 'Listing contacts');
  return (response.data.contacts || []).map((c) => ({ ...c, event_id: `contact.unsubscribed:${c.id}`, event_at: c.unsubscribed_at || c.created_at }));
};

module.exports = makeHookTrigger({
  key: 'new_unsubscribe',
  noun: 'Unsubscribe',
  label: 'Contact Unsubscribed',
  description: 'Triggers when a contact unsubscribes (from a link in an email, the preferences page, or the API).',
  event: 'contact.unsubscribed',
  sample: { ...sampleContact, status: 'unsubscribed', unsubscribed_at: '2026-09-06T08:00:00.000Z', event_id: 'ev_7a2d3c4b', event_at: '2026-09-06T08:00:00.000Z' },
  outputFields: contactOutputFields,
  performList,
});
