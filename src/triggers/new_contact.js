'use strict';

const { BASE_URL, check } = require('../api');
const { makeHookTrigger, sampleContact, contactOutputFields } = require('./hooks');

// Recent contacts, newest first, used for the sample data in the Zap editor.
const performList = async (z) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { limit: 25 }, skipThrowForStatus: true });
  check(z, response, 'Listing contacts');
  return (response.data.contacts || []).map((c) => ({ ...c, event_id: `contact.created:${c.id}`, event_at: c.created_at }));
};

module.exports = makeHookTrigger({
  key: 'new_contact',
  noun: 'Contact',
  label: 'New Contact',
  description: 'Triggers when a contact is added to the workspace — by a form, an import, the API or by hand.',
  event: 'contact.created',
  sample: { ...sampleContact, event_id: 'ev_6f1c2b3a', event_at: sampleContact.created_at },
  outputFields: contactOutputFields,
  performList,
});
