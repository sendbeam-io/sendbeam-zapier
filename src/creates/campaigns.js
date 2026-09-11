'use strict';

const { BASE_URL, check, text, yes, jsonBody } = require('../api');
const s = require('../triggers/samples');

const campaignField = { key: 'campaign_id', label: 'Campaign', required: true, dynamic: 'campaign.id.name' };

const create_campaign = {
  key: 'create_campaign',
  noun: 'Campaign',
  display: {
    label: 'Create Campaign',
    description: 'Creates a draft campaign for all subscribed contacts, a list or a segment. Send it with Send Campaign. Needs campaigns:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const input = bundle.inputData;
      const audience = text(input.send_to_type) || 'all';
      const body = {
        name: text(input.name),
        subject: input.subject,
        from_email: text(input.from_email),
        html_content: input.html_content,
        send_to_type: audience,
      };
      if (audience === 'list') {
        if (!text(input.list_id)) throw new z.errors.Error('Choose the list to send to.', 'MissingList', 400);
        body.send_to_id = text(input.list_id);
      }
      if (audience === 'segment') {
        if (!text(input.segment_id)) throw new z.errors.Error('Choose the segment to send to.', 'MissingSegment', 400);
        body.send_to_id = text(input.segment_id);
      }
      if (text(input.from_name)) body.from_name = text(input.from_name);
      if (text(input.text_content)) body.text_content = input.text_content;
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/campaigns`, ...jsonBody(body), skipThrowForStatus: true });
      check(z, response, 'Creating the campaign');
      return response.data.campaign || response.data;
    },
    inputFields: [
      { key: 'name', label: 'Name', required: true, type: 'string', helpText: 'For you to find it by. Recipients see the subject, not this.' },
      { key: 'subject', label: 'Subject', required: true, type: 'string' },
      { key: 'from_email', label: 'From Email', required: true, type: 'string', helpText: 'The workspace\'s own sender address, or one on a domain verified in SendBeam.' },
      { key: 'from_name', label: 'From Name', required: false, type: 'string' },
      {
        key: 'send_to_type',
        label: 'Audience',
        required: true,
        default: 'all',
        choices: [
          { value: 'all', label: 'All subscribed contacts', sample: 'all' },
          { value: 'list', label: 'A list', sample: 'list' },
          { value: 'segment', label: 'A segment', sample: 'segment' },
        ],
      },
      { key: 'list_id', label: 'List', required: false, dynamic: 'list.id.name', helpText: 'Required when the audience is a list.' },
      { key: 'segment_id', label: 'Segment', required: false, dynamic: 'segment.id.name', helpText: 'Required when the audience is a segment.' },
      { key: 'html_content', label: 'HTML Content', required: true, type: 'text', helpText: 'Merge tags such as {{first_name}} are filled in for each recipient.' },
      { key: 'text_content', label: 'Text Content', required: false, type: 'text', helpText: 'A plain-text version of the email.' },
    ],
    sample: s.sampleCampaign,
    outputFields: s.campaignOutputFields,
  },
};

const send_campaign = {
  key: 'send_campaign',
  noun: 'Campaign',
  display: {
    label: 'Send Campaign',
    description: 'Sends a draft campaign now, or schedules it for later. Needs campaigns:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { campaign_id, scheduled_at } = bundle.inputData;
      const body = text(scheduled_at) ? { scheduled_at: new Date(scheduled_at).toISOString() } : {};
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/campaigns/${campaign_id}/send`, body, skipThrowForStatus: true });
      check(z, response, 'Sending the campaign');
      const data = response.data || {};
      return {
        id: data.id || campaign_id,
        status: data.status || (body.scheduled_at ? 'scheduled' : 'sending'),
        scheduled_at: data.scheduled_at || body.scheduled_at || null,
        queued: typeof data.queued === 'number' ? data.queued : null,
      };
    },
    inputFields: [
      campaignField,
      { key: 'scheduled_at', label: 'Send At', required: false, type: 'datetime', helpText: 'Leave empty to send now.' },
    ],
    sample: { id: s.IDS.campaign, status: 'sending', scheduled_at: null, queued: 1834 },
    outputFields: [
      { key: 'id', label: 'Campaign ID' },
      { key: 'status', label: 'Status' },
      { key: 'scheduled_at', label: 'Scheduled At', type: 'datetime' },
      { key: 'queued', label: 'Recipients Queued', type: 'integer' },
    ],
  },
};

const duplicate_campaign = {
  key: 'duplicate_campaign',
  noun: 'Campaign',
  display: {
    label: 'Duplicate Campaign',
    description: 'Copies a campaign into a new draft, optionally addressed only to the people who did not open the original. Needs campaigns:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { campaign_id, non_openers } = bundle.inputData;
      const body = yes(non_openers) ? { audience: 'non_openers' } : {};
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/campaigns/${campaign_id}/duplicate`, body, skipThrowForStatus: true });
      check(z, response, 'Duplicating the campaign');
      return response.data.campaign || response.data;
    },
    inputFields: [
      campaignField,
      { key: 'non_openers', label: 'Only Non-Openers', required: false, type: 'boolean', default: 'false', helpText: 'Send the copy only to recipients of the original who did not open it.' },
    ],
    sample: s.sampleCampaign,
    outputFields: s.campaignOutputFields,
  },
};

const delete_campaign = {
  key: 'delete_campaign',
  noun: 'Campaign',
  display: {
    label: 'Delete Campaign',
    description: 'Deletes a draft or cancelled campaign. Needs campaigns:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { campaign_id } = bundle.inputData;
      const response = await z.request({ method: 'DELETE', url: `${BASE_URL}/campaigns/${campaign_id}`, skipThrowForStatus: true });
      check(z, response, 'Deleting the campaign');
      return { id: campaign_id, deleted: true };
    },
    inputFields: [campaignField],
    sample: { id: s.IDS.campaign, deleted: true },
    outputFields: [
      { key: 'id', label: 'Campaign ID' },
      { key: 'deleted', label: 'Deleted', type: 'boolean' },
    ],
  },
};

module.exports = { create_campaign, send_campaign, duplicate_campaign, delete_campaign };
