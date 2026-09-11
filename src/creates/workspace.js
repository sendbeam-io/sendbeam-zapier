'use strict';

const { BASE_URL, check, text, yes } = require('../api');
const s = require('../triggers/samples');

/**
 * Start an automation for one contact. SendBeam enrols them only when the
 * automation is active and has an API trigger, and the contact is subscribed,
 * not already in it and past its repeat cooldown; anything else answers 409
 * with the reason, which stops the Zap step without counting as an error.
 */
const start_automation = {
  key: 'start_automation',
  noun: 'Automation',
  display: {
    label: 'Start Automation for Contact',
    description: 'Starts an active automation with an API trigger for a subscribed contact. Needs automations:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { automation_id, email } = bundle.inputData;
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/automations/${automation_id}/trigger`, body: { email: String(email).trim() }, skipThrowForStatus: true });
      const data = response.data || {};
      if (response.status === 409 && data.enrolled === false) {
        throw new z.errors.HaltedError(data.reason || 'SendBeam did not start the automation for this contact.');
      }
      check(z, response, 'Starting the automation');
      return { enrolled: data.enrolled !== false, automation_id: data.automation_id || automation_id, contact_id: data.contact_id || null };
    },
    inputFields: [
      { key: 'automation_id', label: 'Automation', required: true, dynamic: 'automation.id.name', helpText: 'An active automation whose trigger is set to API in SendBeam.' },
      { key: 'email', label: 'Email', required: true, type: 'string', helpText: 'The email address of a subscribed contact.' },
    ],
    sample: { enrolled: true, automation_id: s.IDS.automation, contact_id: s.IDS.contact },
    outputFields: [
      { key: 'enrolled', label: 'Enrolled', type: 'boolean' },
      { key: 'automation_id', label: 'Automation ID' },
      { key: 'contact_id', label: 'Contact ID' },
    ],
  },
};

const create_list = {
  key: 'create_list',
  noun: 'List',
  display: {
    label: 'Create List',
    description: 'Creates a list. Needs lists:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const input = bundle.inputData;
      const body = { name: text(input.name) };
      if (text(input.description)) body.description = text(input.description);
      if (input.double_optin !== undefined && input.double_optin !== '') body.double_optin = yes(input.double_optin);
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/lists`, body, skipThrowForStatus: true });
      check(z, response, 'Creating the list');
      return response.data.list || response.data;
    },
    inputFields: [
      { key: 'name', label: 'Name', required: true, type: 'string' },
      { key: 'description', label: 'Description', required: false, type: 'string' },
      { key: 'double_optin', label: 'Double Opt-In', required: false, type: 'boolean', helpText: 'Whether new members must confirm by email before campaigns reach them.' },
    ],
    sample: s.sampleList,
    outputFields: s.listOutputFields,
  },
};

const create_tag = {
  key: 'create_tag',
  noun: 'Tag',
  display: {
    label: 'Create Tag',
    description: 'Creates a tag. Needs tags:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const input = bundle.inputData;
      const body = { name: text(input.name) };
      if (text(input.color)) body.color = text(input.color);
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/tags`, body, skipThrowForStatus: true });
      check(z, response, 'Creating the tag');
      return response.data.tag || response.data;
    },
    inputFields: [
      { key: 'name', label: 'Name', required: true, type: 'string' },
      { key: 'color', label: 'Colour', required: false, type: 'string', helpText: 'A hex colour such as #6B7280.' },
    ],
    sample: s.sampleTag,
    outputFields: s.tagOutputFields,
  },
};

module.exports = { start_automation, create_list, create_tag };
