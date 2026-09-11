'use strict';

const {
  BASE_URL,
  check,
  text,
  yes,
  findContactByEmail,
  requireContact,
  createOrFindContact,
  resolveTagId,
  customFields,
} = require('../api');
const s = require('../triggers/samples');

const emailField = { key: 'email', label: 'Email', required: true, type: 'string', helpText: 'The contact\'s email address.' };
const tagField = {
  key: 'tag',
  label: 'Tag',
  required: true,
  dynamic: 'tag.id.name',
  helpText: 'Choose a tag, or type or map a tag name.',
};

const addToListRequest = async (z, contactId, listId) => {
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/lists/${listId}/contacts`, body: { contact_id: contactId }, skipThrowForStatus: true });
  if (response.status === 409) return { already_member: true };
  check(z, response, 'Adding to the list');
  return response.data || {};
};

const addTagRequest = async (z, contactId, tagId) => {
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/contacts/${contactId}/tags`, body: { tag_id: tagId }, skipThrowForStatus: true });
  if (response.status === 409) return false;
  check(z, response, 'Adding the tag');
  return true;
};

const patchContact = async (z, id, body, what) => {
  const response = await z.request({ method: 'PATCH', url: `${BASE_URL}/contacts/${id}`, body, skipThrowForStatus: true });
  check(z, response, what);
  return response.data.contact || response.data;
};

// ── Create or Update Contact ───────────────────────────────────────────────

/**
 * Add a contact, or update the one with that email. A contact who
 * unsubscribed stays unsubscribed unless "Re-subscribe" is on, the same rule
 * the API applies, so a Zap never undoes an opt-out. Custom fields are merged
 * onto the existing ones, because the API replaces them wholesale.
 */
const createContact = async (z, bundle) => {
  const input = bundle.inputData;
  const names = {};
  if (text(input.first_name)) names.first_name = text(input.first_name);
  if (text(input.last_name)) names.last_name = text(input.last_name);
  const custom = customFields(input.custom_fields);

  const updateExisting = async (existing) => {
    const patch = { ...names };
    if (custom) patch.custom_fields = { ...(existing.custom_fields || {}), ...custom };
    if (yes(input.resubscribe) && existing.status === 'unsubscribed') patch.resubscribe = true;
    return Object.keys(patch).length ? patchContact(z, existing.id, patch, 'Updating the contact') : existing;
  };

  let contact;
  let created = false;
  const existing = await findContactByEmail(z, input.email);
  if (existing) {
    contact = await updateExisting(existing);
  } else {
    const fields = { ...names, source: text(input.source) || 'zapier' };
    if (custom) fields.custom_fields = custom;
    if (yes(input.resubscribe)) fields.resubscribe = true;
    const result = await createOrFindContact(z, input.email, fields);
    contact = result.created ? result.contact : await updateExisting(result.contact);
    created = result.created;
  }

  if (text(input.list_id)) await addToListRequest(z, contact.id, text(input.list_id));
  if (text(input.tag)) await addTagRequest(z, contact.id, await resolveTagId(z, input.tag, true));

  return { ...contact, created };
};

const create_contact = {
  key: 'create_contact',
  noun: 'Contact',
  display: {
    label: 'Create or Update Contact',
    description: 'Adds a contact, or updates the one with that email address, and optionally puts them on a list and tags them. Needs contacts:read and contacts:write, plus lists:write or tags:read and tags:write for the list and tag.',
  },
  operation: {
    perform: createContact,
    inputFields: [
      emailField,
      { key: 'first_name', label: 'First Name', required: false, type: 'string' },
      { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
      { key: 'custom_fields', label: 'Custom Fields', required: false, dict: true, helpText: 'Field names and values. On an existing contact, the fields you set are changed and the others are kept.' },
      { key: 'list_id', label: 'Add to List', required: false, dynamic: 'list.id.name' },
      { key: 'tag', label: 'Add Tag', required: false, dynamic: 'tag.id.name', helpText: 'Choose a tag, or type or map a tag name. A name the workspace does not have yet is created.' },
      { key: 'source', label: 'Source', required: false, type: 'string', helpText: 'Where a new contact came from, shown on the contact. Defaults to "zapier". Not changed on an existing contact.' },
      { key: 'resubscribe', label: 'Re-Subscribe If Unsubscribed', required: false, type: 'boolean', default: 'false', helpText: 'Off by default: a person who unsubscribed stays unsubscribed. Turn it on only when they have opted in again.' },
    ],
    sample: { ...s.apiContact, created: true },
    outputFields: [...s.apiContactOutputFields, { key: 'created', label: 'Was Created', type: 'boolean' }],
  },
};

// ── Update, unsubscribe, delete ────────────────────────────────────────────

const update_contact = {
  key: 'update_contact',
  noun: 'Contact',
  display: {
    label: 'Update Contact',
    description: 'Changes an existing contact\'s email address, name or custom fields. Needs contacts:read and contacts:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const input = bundle.inputData;
      const contact = await requireContact(z, input.email);
      const patch = {};
      if (text(input.new_email)) patch.email = text(input.new_email);
      if (text(input.first_name)) patch.first_name = text(input.first_name);
      if (text(input.last_name)) patch.last_name = text(input.last_name);
      const custom = customFields(input.custom_fields);
      if (custom) patch.custom_fields = { ...(contact.custom_fields || {}), ...custom };
      if (!Object.keys(patch).length) throw new z.errors.Error('Fill in at least one field to change.', 'NothingToUpdate', 400);
      return patchContact(z, contact.id, patch, 'Updating the contact');
    },
    inputFields: [
      emailField,
      { key: 'new_email', label: 'New Email', required: false, type: 'string' },
      { key: 'first_name', label: 'First Name', required: false, type: 'string' },
      { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
      { key: 'custom_fields', label: 'Custom Fields', required: false, dict: true, helpText: 'The fields you set are changed; the contact\'s other custom fields are kept.' },
    ],
    sample: s.apiContact,
    outputFields: s.apiContactOutputFields,
  },
};

const unsubscribe_contact = {
  key: 'unsubscribe_contact',
  noun: 'Contact',
  display: {
    label: 'Unsubscribe Contact',
    description: 'Stops all marketing email to a contact. Needs contacts:read and contacts:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const contact = await requireContact(z, bundle.inputData.email);
      return patchContact(z, contact.id, { status: 'unsubscribed' }, 'Unsubscribing the contact');
    },
    inputFields: [emailField],
    sample: { ...s.apiContact, status: 'unsubscribed', unsubscribed_at: s.EVENT_AT },
    outputFields: s.apiContactOutputFields,
  },
};

const delete_contact = {
  key: 'delete_contact',
  noun: 'Contact',
  display: {
    label: 'Delete Contact',
    description: 'Permanently deletes a contact. Their address is suppressed, so it cannot be added back through the API. Needs contacts:read and contacts:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const contact = await requireContact(z, bundle.inputData.email);
      const response = await z.request({ method: 'DELETE', url: `${BASE_URL}/contacts/${contact.id}`, skipThrowForStatus: true });
      check(z, response, 'Deleting the contact');
      return { id: contact.id, email: contact.email, deleted: true };
    },
    inputFields: [emailField],
    sample: { id: s.IDS.contact, email: 'ada@example.com', deleted: true },
    outputFields: [
      { key: 'id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'deleted', label: 'Deleted', type: 'boolean' },
    ],
  },
};

// ── Lists ──────────────────────────────────────────────────────────────────

const add_to_list = {
  key: 'add_to_list',
  noun: 'List Member',
  display: {
    label: 'Add Contact to List',
    description: 'Adds a contact to a list, creating the contact first if the email address is new. Needs contacts:read, contacts:write and lists:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { email, list_id } = bundle.inputData;
      const { contact } = await createOrFindContact(z, email, { source: 'zapier' });
      const result = await addToListRequest(z, contact.id, list_id);
      return {
        contact_id: contact.id,
        email: contact.email,
        list_id,
        membership: result.membership || 'confirmed',
        double_optin_sent: Boolean(result.double_optin_sent),
        added: !result.already_member,
      };
    },
    inputFields: [emailField, { key: 'list_id', label: 'List', required: true, dynamic: 'list.id.name' }],
    sample: { contact_id: s.IDS.contact, email: 'ada@example.com', list_id: s.IDS.list, membership: 'pending_confirmation', double_optin_sent: true, added: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'list_id', label: 'List ID' },
      { key: 'membership', label: 'Membership' },
      { key: 'double_optin_sent', label: 'Confirmation Email Sent', type: 'boolean' },
      { key: 'added', label: 'Was Added', type: 'boolean' },
    ],
  },
};

const remove_from_list = {
  key: 'remove_from_list',
  noun: 'List Member',
  display: {
    label: 'Remove Contact From List',
    description: 'Takes a contact off a list. The contact stays in the workspace. Needs contacts:read and lists:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { email, list_id } = bundle.inputData;
      const contact = await requireContact(z, email);
      const response = await z.request({ method: 'DELETE', url: `${BASE_URL}/lists/${list_id}/contacts`, body: { contact_id: contact.id }, skipThrowForStatus: true });
      check(z, response, 'Removing from the list');
      return { contact_id: contact.id, email: contact.email, list_id, removed: true };
    },
    inputFields: [emailField, { key: 'list_id', label: 'List', required: true, dynamic: 'list.id.name' }],
    sample: { contact_id: s.IDS.contact, email: 'ada@example.com', list_id: s.IDS.list, removed: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'list_id', label: 'List ID' },
      { key: 'removed', label: 'Removed', type: 'boolean' },
    ],
  },
};

// ── Tags ───────────────────────────────────────────────────────────────────

const add_tag = {
  key: 'add_tag',
  noun: 'Tag',
  display: {
    label: 'Add Tag to Contact',
    description: 'Tags an existing contact, creating the tag if the workspace does not have it yet. Needs contacts:read, tags:read and tags:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { email, tag } = bundle.inputData;
      const contact = await requireContact(z, email);
      const tagId = await resolveTagId(z, tag, true);
      const added = await addTagRequest(z, contact.id, tagId);
      return { contact_id: contact.id, email: contact.email, tag_id: tagId, added };
    },
    inputFields: [emailField, { ...tagField, helpText: 'Choose a tag, or type or map a tag name. A name the workspace does not have yet is created.' }],
    sample: { contact_id: s.IDS.contact, email: 'ada@example.com', tag_id: s.IDS.tag, added: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'tag_id', label: 'Tag ID' },
      { key: 'added', label: 'Was Added', type: 'boolean' },
    ],
  },
};

const remove_tag = {
  key: 'remove_tag',
  noun: 'Tag',
  display: {
    label: 'Remove Tag From Contact',
    description: 'Removes a tag from a contact. Needs contacts:read, tags:read and tags:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { email, tag } = bundle.inputData;
      const contact = await requireContact(z, email);
      const tagId = await resolveTagId(z, tag, false);
      const response = await z.request({ method: 'DELETE', url: `${BASE_URL}/contacts/${contact.id}/tags/${tagId}`, skipThrowForStatus: true });
      check(z, response, 'Removing the tag');
      return { contact_id: contact.id, email: contact.email, tag_id: tagId, removed: true };
    },
    inputFields: [emailField, tagField],
    sample: { contact_id: s.IDS.contact, email: 'ada@example.com', tag_id: s.IDS.tag, removed: true },
    outputFields: [
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
      { key: 'tag_id', label: 'Tag ID' },
      { key: 'removed', label: 'Removed', type: 'boolean' },
    ],
  },
};

module.exports = {
  create_contact,
  update_contact,
  unsubscribe_contact,
  delete_contact,
  add_to_list,
  remove_from_list,
  add_tag,
  remove_tag,
};
