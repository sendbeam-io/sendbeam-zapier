'use strict';

const { BASE_URL, check, createOrFindContact } = require('../api');

const perform = async (z, bundle) => {
  const { email, list_id } = bundle.inputData;
  const { contact } = await createOrFindContact(z, email, { source: 'zapier' });
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/lists/${list_id}/contacts`, body: { contact_id: contact.id }, skipThrowForStatus: true });
  if (response.status === 409) return { contact_id: contact.id, email: contact.email, list_id, added: false };
  check(z, response, 'Adding to the list');
  return { contact_id: contact.id, email: contact.email, list_id, added: true };
};

module.exports = {
  key: 'add_to_list',
  noun: 'List member',
  display: { label: 'Add Contact to List', description: 'Adds a contact to a list, creating the contact first if the email is new.' },
  operation: {
    perform,
    inputFields: [
      { key: 'email', label: 'Email', required: true, type: 'string' },
      { key: 'list_id', label: 'List', required: true, dynamic: 'list.id.name' },
    ],
    sample: { contact_id: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10', email: 'ada@example.com', list_id: '9c2b1a0f-1111-4222-8333-444455556666', added: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'list_id', label: 'List ID' },
      { key: 'added', label: 'Was added (false = already a member)', type: 'boolean' },
    ],
  },
};
