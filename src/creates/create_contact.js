'use strict';

const { BASE_URL, check, createOrFindContact } = require('../api');
const { sampleContact } = require('../triggers/hooks');

/**
 * Add a contact, or update the one that already has that email. A contact
 * that unsubscribed stays unsubscribed unless "Re-subscribe" is on — that is
 * the same rule the API applies, and it keeps a Zap from undoing an opt-out.
 */
const perform = async (z, bundle) => {
  const { email, first_name, last_name, source, resubscribe, list_id, tag_id } = bundle.inputData;
  const fields = {};
  if (first_name) fields.first_name = first_name;
  if (last_name) fields.last_name = last_name;
  fields.source = source || 'zapier';
  if (resubscribe) fields.resubscribe = true;

  const { contact, created } = await createOrFindContact(z, email, fields);

  if (!created && (first_name || last_name || resubscribe)) {
    const patch = {};
    if (first_name) patch.first_name = first_name;
    if (last_name) patch.last_name = last_name;
    if (resubscribe) patch.resubscribe = true;
    const response = await z.request({ method: 'PATCH', url: `${BASE_URL}/contacts/${contact.id}`, body: patch, skipThrowForStatus: true });
    check(z, response, 'Updating the contact');
    Object.assign(contact, response.data.contact || response.data);
  }

  if (list_id) {
    const response = await z.request({ method: 'POST', url: `${BASE_URL}/lists/${list_id}/contacts`, body: { contact_id: contact.id }, skipThrowForStatus: true });
    if (response.status !== 409) check(z, response, 'Adding to the list');
  }
  if (tag_id) {
    const response = await z.request({ method: 'POST', url: `${BASE_URL}/contacts/${contact.id}/tags`, body: { tag_id }, skipThrowForStatus: true });
    if (response.status !== 409) check(z, response, 'Adding the tag');
  }

  return { ...contact, created };
};

module.exports = {
  key: 'create_contact',
  noun: 'Contact',
  display: {
    label: 'Create or Update Contact',
    description: 'Adds a contact to the workspace, or updates the one with that email. Optionally puts them on a list and tags them.',
  },
  operation: {
    perform,
    inputFields: [
      { key: 'email', label: 'Email', required: true, type: 'string' },
      { key: 'first_name', label: 'First name', required: false, type: 'string' },
      { key: 'last_name', label: 'Last name', required: false, type: 'string' },
      { key: 'list_id', label: 'Add to list', required: false, dynamic: 'list.id.name' },
      { key: 'tag_id', label: 'Add tag', required: false, dynamic: 'tag.id.name' },
      { key: 'source', label: 'Source', required: false, type: 'string', helpText: 'Where this contact came from, shown on the contact. Defaults to "zapier".' },
      { key: 'resubscribe', label: 'Re-subscribe if unsubscribed', required: false, type: 'boolean', default: 'false', helpText: 'Off by default: a person who unsubscribed stays unsubscribed. Turn on only when they have opted in again.' },
    ],
    sample: { ...sampleContact, created: true },
    outputFields: [
      { key: 'id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'created', label: 'Was created (false = already existed)', type: 'boolean' },
    ],
  },
};
