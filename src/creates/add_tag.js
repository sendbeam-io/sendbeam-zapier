'use strict';

const { BASE_URL, check, findContactByEmail } = require('../api');

const perform = async (z, bundle) => {
  const { email, tag_id } = bundle.inputData;
  const contact = await findContactByEmail(z, email);
  if (!contact) throw new z.errors.Error(`No contact with the email ${email} in this workspace.`, 'NotFound', 404);
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/contacts/${contact.id}/tags`, body: { tag_id }, skipThrowForStatus: true });
  if (response.status === 409) return { contact_id: contact.id, email: contact.email, tag_id, added: false };
  check(z, response, 'Adding the tag');
  return { contact_id: contact.id, email: contact.email, tag_id, added: true };
};

module.exports = {
  key: 'add_tag',
  noun: 'Tag',
  display: { label: 'Add Tag to Contact', description: 'Tags an existing contact. Fails if the email is not in the workspace yet.' },
  operation: {
    perform,
    inputFields: [
      { key: 'email', label: 'Email', required: true, type: 'string' },
      { key: 'tag_id', label: 'Tag', required: true, dynamic: 'tag.id.name' },
    ],
    sample: { contact_id: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10', email: 'ada@example.com', tag_id: '5d6e7f80-2222-4333-8444-555566667777', added: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'tag_id', label: 'Tag ID' },
      { key: 'added', label: 'Was added (false = already tagged)', type: 'boolean' },
    ],
  },
};
