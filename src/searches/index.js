'use strict';

const { BASE_URL, check, text, findContactByEmail, getAll, listAll } = require('../api');
const s = require('../triggers/samples');

const byName = (rows, name) => {
  const wanted = String(name || '').trim().toLowerCase();
  return rows.filter((row) => String(row.name).trim().toLowerCase() === wanted);
};

const find_contact = {
  key: 'find_contact',
  noun: 'Contact',
  display: {
    label: 'Find Contact',
    description: 'Finds a contact by email address. Needs contacts:read.',
  },
  operation: {
    perform: async (z, bundle) => {
      const contact = await findContactByEmail(z, bundle.inputData.email);
      return contact ? [contact] : [];
    },
    inputFields: [{ key: 'email', label: 'Email', required: true, type: 'string' }],
    sample: s.apiContact,
    outputFields: s.apiContactOutputFields,
  },
};

const find_list = {
  key: 'find_list',
  noun: 'List',
  display: {
    label: 'Find List',
    description: 'Finds a list by its name. Needs lists:read.',
  },
  operation: {
    perform: async (z, bundle) => byName(await getAll(z, '/lists', 'lists', 'Listing lists'), bundle.inputData.name),
    inputFields: [{ key: 'name', label: 'Name', required: true, type: 'string', helpText: 'The list\'s exact name. Capital letters do not matter.' }],
    sample: s.sampleList,
    outputFields: s.listOutputFields,
  },
};

const find_tag = {
  key: 'find_tag',
  noun: 'Tag',
  display: {
    label: 'Find Tag',
    description: 'Finds a tag by its name. Needs tags:read.',
  },
  operation: {
    perform: async (z, bundle) => byName(await getAll(z, '/tags', 'tags', 'Listing tags'), bundle.inputData.name),
    inputFields: [{ key: 'name', label: 'Name', required: true, type: 'string', helpText: 'The tag\'s exact name. Capital letters do not matter.' }],
    sample: s.sampleTag,
    outputFields: s.tagOutputFields,
  },
};

const find_campaign = {
  key: 'find_campaign',
  noun: 'Campaign',
  display: {
    label: 'Find Campaign',
    description: 'Finds a campaign by its name, newest first. Needs campaigns:read.',
  },
  operation: {
    perform: async (z, bundle) => {
      const params = {};
      if (text(bundle.inputData.status)) params.status = text(bundle.inputData.status);
      return byName(await listAll(z, '/campaigns', 'campaigns', params, 'Listing campaigns'), bundle.inputData.name);
    },
    inputFields: [
      { key: 'name', label: 'Name', required: true, type: 'string', helpText: 'The campaign\'s exact name. Capital letters do not matter.' },
      {
        key: 'status',
        label: 'Status',
        required: false,
        choices: [
          { value: 'draft', label: 'Draft', sample: 'draft' },
          { value: 'scheduled', label: 'Scheduled', sample: 'scheduled' },
          { value: 'sending', label: 'Sending', sample: 'sending' },
          { value: 'sent', label: 'Sent', sample: 'sent' },
          { value: 'cancelled', label: 'Cancelled', sample: 'cancelled' },
        ],
      },
    ],
    sample: s.sampleCampaign,
    outputFields: s.campaignOutputFields,
  },
};

const get_campaign_report = {
  key: 'get_campaign_report',
  noun: 'Campaign Report',
  display: {
    label: 'Get Campaign Report',
    description: 'Gets a campaign\'s opens and clicks, the links people clicked, and the email clients and devices they used. Needs campaigns:read.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { campaign_id } = bundle.inputData;
      const response = await z.request({ url: `${BASE_URL}/campaigns/${campaign_id}/report`, skipThrowForStatus: true });
      if (response.status === 404) return [];
      check(z, response, 'Getting the report');
      return [{ id: campaign_id, ...response.data }];
    },
    inputFields: [{ key: 'campaign_id', label: 'Campaign', required: true, dynamic: 'campaign.id.name' }],
    sample: { id: s.IDS.campaign, ...s.sampleReport },
    outputFields: [
      { key: 'campaign_id', label: 'Campaign ID' },
      { key: 'opens', label: 'Opens', type: 'integer' },
      { key: 'clicks', label: 'Clicks', type: 'integer' },
    ],
  },
};

module.exports = { find_contact, find_list, find_tag, find_campaign, get_campaign_report };
