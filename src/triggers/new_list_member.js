'use strict';

const { BASE_URL, check } = require('../api');
const { makeHookTrigger, sampleContact, contactOutputFields } = require('./hooks');

// Sample data: members of the chosen list (or any list), newest first.
const performList = async (z, bundle) => {
  const listId = bundle.inputData.list_id;
  const listsRes = await z.request({ url: `${BASE_URL}/lists`, skipThrowForStatus: true });
  check(z, listsRes, 'Listing lists');
  const lists = listsRes.data.lists || [];
  const list = lists.find((l) => l.id === listId) || lists[0];
  if (!list) return [];
  const response = await z.request({ url: `${BASE_URL}/lists/${list.id}/contacts`, params: { limit: 25 }, skipThrowForStatus: true });
  check(z, response, 'Listing list members');
  return (response.data.contacts || []).map((c) => ({ ...c, list: { id: list.id, name: list.name }, event_id: `contact.list_joined:${list.id}:${c.id}`, event_at: c.created_at }));
};

module.exports = makeHookTrigger({
  key: 'new_list_member',
  noun: 'List member',
  label: 'Contact Added to List',
  description: 'Triggers when a contact joins a list — optionally only one particular list.',
  event: 'contact.list_joined',
  inputFields: [
    {
      key: 'list_id',
      label: 'List',
      required: false,
      dynamic: 'list.id.name',
      helpText: 'Leave empty to trigger for every list.',
    },
  ],
  keep: (data, bundle) => !bundle.inputData.list_id || (data.list && data.list.id === bundle.inputData.list_id),
  sample: { ...sampleContact, list: { id: '9c2b1a0f-1111-4222-8333-444455556666', name: 'Product updates' }, event_id: 'ev_8b3e4d5c', event_at: sampleContact.created_at },
  outputFields: [...contactOutputFields, { key: 'list__id', label: 'List ID' }, { key: 'list__name', label: 'List name' }],
  performList,
});
