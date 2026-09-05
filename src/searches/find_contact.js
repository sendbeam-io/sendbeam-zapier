'use strict';

const { findContactByEmail } = require('../api');
const { sampleContact, contactOutputFields } = require('../triggers/hooks');

module.exports = {
  key: 'find_contact',
  noun: 'Contact',
  display: { label: 'Find Contact', description: 'Finds a contact by email address.' },
  operation: {
    perform: async (z, bundle) => {
      const contact = await findContactByEmail(z, bundle.inputData.email);
      return contact ? [contact] : [];
    },
    inputFields: [{ key: 'email', label: 'Email', required: true, type: 'string' }],
    sample: sampleContact,
    outputFields: contactOutputFields.filter((f) => !f.key.startsWith('event_')),
  },
};
