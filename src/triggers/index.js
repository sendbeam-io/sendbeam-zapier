'use strict';

/**
 * One instant trigger per SendBeam webhook event. The event list must match
 * SendBeam's own (test/contract.test.js checks it against the API
 * description).
 */

const { BASE_URL, check, getAll } = require('../api');
const { makeHookTrigger, nothingToList } = require('./hooks');
const s = require('./samples');

const filters = {
  list: {
    key: 'list_id',
    label: 'List',
    dynamic: 'list.id.name',
    helpText: 'Leave empty to trigger for every list.',
    dimension: 'list_ids',
    valueOf: (data) => data.list && data.list.id,
  },
  tag: {
    key: 'tag_id',
    label: 'Tag',
    dynamic: 'tag.id.name',
    helpText: 'Leave empty to trigger for every tag.',
    dimension: 'tag_ids',
    valueOf: (data) => data.tag && data.tag.id,
  },
  campaign: {
    key: 'campaign_id',
    label: 'Campaign',
    dynamic: 'campaign.id.name',
    helpText: 'Leave empty to trigger for every email. When a campaign is chosen, emails that are not part of it (automation steps, single sends) do not trigger.',
    dimension: 'campaign_ids',
    valueOf: (data) => data.campaign_id,
  },
  form: {
    key: 'form_id',
    label: 'Form',
    dynamic: 'form.id.name',
    helpText: 'Leave empty to trigger for every form. You can also paste a form ID from SendBeam → Forms → your form → Embed.',
    dimension: 'form_ids',
    valueOf: (data) => data.form_id,
  },
};

/** Recent contacts, optionally with one status, for sample data in the Zap editor. */
const recentContacts = (event, status, when = (c) => c.created_at) => async (z) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { limit: 25, ...(status ? { status } : {}) }, skipThrowForStatus: true });
  check(z, response, 'Listing contacts');
  return (response.data.contacts || []).map((c) => ({ ...c, event_id: `${event}:${c.id}`, event_at: when(c) }));
};

const chosenId = (bundle, key) => String((bundle.inputData || {})[key] || '').trim().toLowerCase();

/** Contacts who have the chosen tag (or the first tag), for sample data. */
const taggedContacts = async (z, bundle) => {
  const tags = await getAll(z, '/tags', 'tags', 'Listing tags');
  const wanted = chosenId(bundle, 'tag_id');
  const tag = wanted ? tags.find((t) => t.id === wanted) : tags[0];
  if (!tag) return [];
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { tag: tag.id, limit: 25 }, skipThrowForStatus: true });
  check(z, response, 'Listing contacts');
  return (response.data.contacts || []).map((c) => ({ ...c, tag: { id: tag.id, name: tag.name }, event_id: `contact.tag_added:${tag.id}:${c.id}`, event_at: c.created_at }));
};

/** Members of the chosen list (or the first list), for sample data. */
const listMembers = async (z, bundle) => {
  const lists = await getAll(z, '/lists', 'lists', 'Listing lists');
  const wanted = chosenId(bundle, 'list_id');
  const list = wanted ? lists.find((l) => l.id === wanted) : lists[0];
  if (!list) return [];
  const response = await z.request({ url: `${BASE_URL}/lists/${list.id}/contacts`, params: { limit: 25 }, skipThrowForStatus: true });
  check(z, response, 'Listing list members');
  return (response.data.contacts || []).map(({ added_at, ...c }) => ({
    ...c,
    list: { id: list.id, name: list.name },
    event_id: `contact.list_joined:${list.id}:${c.id}`,
    event_at: added_at || c.created_at,
  }));
};

/** Sent campaigns, in the shape of a campaign.sent delivery, for sample data. */
const sentCampaigns = async (z, bundle) => {
  const response = await z.request({ url: `${BASE_URL}/campaigns`, params: { status: 'sent', limit: 25 }, skipThrowForStatus: true });
  check(z, response, 'Listing campaigns');
  const wanted = chosenId(bundle, 'campaign_id');
  return (response.data.campaigns || [])
    .filter((c) => !wanted || c.id === wanted)
    .map((c) => ({
      campaign_id: c.id,
      name: c.name,
      sent_at: c.sent_at,
      recipients: c.stats_sent,
      delivered: c.stats_delivered,
      bounced: c.stats_bounced,
      event_id: `campaign.sent:${c.id}`,
      event_at: c.sent_at,
    }));
};

const contactTrigger = ({ key, event, label, description, status, extra = {}, extraFields = [], filter, performList }) =>
  makeHookTrigger({
    key,
    noun: 'Contact',
    label,
    description,
    event,
    filter,
    performList,
    sample: s.withEvent({ ...s.sampleContact, ...(status ? { status } : {}), ...extra }, `ev_${key}`),
    outputFields: [...s.contactOutputFields, ...extraFields, ...s.eventOutputFields],
  });

const tagFields = [{ key: 'tag__id', label: 'Tag ID' }, { key: 'tag__name', label: 'Tag Name' }];
const listFields = [{ key: 'list__id', label: 'List ID' }, { key: 'list__name', label: 'List Name' }];
const sampleTagRef = { tag: { id: s.IDS.tag, name: 'customer' } };
const sampleListRef = { list: { id: s.IDS.list, name: 'Product updates' } };

const emailTrigger = ({ key, event, label, description, extra = {}, extraFields = [] }) =>
  makeHookTrigger({
    key,
    noun: 'Email',
    label,
    description,
    event,
    filter: filters.campaign,
    sample: s.withEvent({ ...s.sampleSend, ...extra }, `ev_${key}`),
    outputFields: [...s.sendOutputFields, ...extraFields, ...s.eventOutputFields],
  });

const occurred = { occurred_at: s.EVENT_AT };
const occurredField = [{ key: 'occurred_at', label: 'Occurred At', type: 'datetime' }];
const { message_id: _unusedMessageId, ...engagementSend } = s.sampleSend;

const triggers = [
  contactTrigger({
    key: 'new_contact',
    event: 'contact.created',
    label: 'New Contact',
    description: 'Triggers when a contact is added to the workspace, by a form, an import, the API or by hand.',
    performList: recentContacts('contact.created'),
  }),
  contactTrigger({
    key: 'contact_updated',
    event: 'contact.updated',
    label: 'Contact Updated',
    description: 'Triggers when a contact\'s details change. Changes to lists and tags have their own triggers.',
    performList: recentContacts('contact.updated'),
  }),
  contactTrigger({
    key: 'new_unsubscribe',
    event: 'contact.unsubscribed',
    label: 'Contact Unsubscribed',
    description: 'Triggers when a contact unsubscribes, from a link in an email, the preferences page or the API.',
    status: 'unsubscribed',
    extra: { unsubscribed_at: s.EVENT_AT },
    performList: recentContacts('contact.unsubscribed', 'unsubscribed', (c) => c.unsubscribed_at || c.created_at),
  }),
  contactTrigger({
    key: 'contact_resubscribed',
    event: 'contact.resubscribed',
    label: 'Contact Resubscribed',
    description: 'Triggers when a contact who had unsubscribed subscribes again with fresh consent.',
  }),
  contactTrigger({
    key: 'contact_bounced',
    event: 'contact.bounced',
    label: 'Contact Bounced',
    description: 'Triggers when a contact\'s address bounces and SendBeam stops emailing it.',
    status: 'bounced',
    performList: recentContacts('contact.bounced', 'bounced'),
  }),
  contactTrigger({
    key: 'contact_complained',
    event: 'contact.complained',
    label: 'Contact Complained',
    description: 'Triggers when a contact marks an email as spam and SendBeam stops emailing them.',
    status: 'complained',
    performList: recentContacts('contact.complained', 'complained'),
  }),
  contactTrigger({
    key: 'contact_deleted',
    event: 'contact.deleted',
    label: 'Contact Deleted',
    description: 'Triggers when a contact is deleted from the workspace.',
  }),
  contactTrigger({
    key: 'tag_added',
    event: 'contact.tag_added',
    label: 'Tag Added to Contact',
    description: 'Triggers when a tag is added to a contact, optionally only one particular tag.',
    extra: sampleTagRef,
    extraFields: tagFields,
    filter: filters.tag,
    performList: taggedContacts,
  }),
  contactTrigger({
    key: 'tag_removed',
    event: 'contact.tag_removed',
    label: 'Tag Removed From Contact',
    description: 'Triggers when a tag is removed from a contact, optionally only one particular tag.',
    extra: sampleTagRef,
    extraFields: tagFields,
    filter: filters.tag,
  }),
  contactTrigger({
    key: 'new_list_member',
    event: 'contact.list_joined',
    label: 'Contact Added to List',
    description: 'Triggers when a contact joins a list, optionally only one particular list. On a double opt-in list, that is when they confirm.',
    extra: sampleListRef,
    extraFields: listFields,
    filter: filters.list,
    performList: listMembers,
  }),
  contactTrigger({
    key: 'list_member_removed',
    event: 'contact.list_left',
    label: 'Contact Removed From List',
    description: 'Triggers when a contact leaves or is removed from a list, optionally only one particular list.',
    extra: sampleListRef,
    extraFields: listFields,
    filter: filters.list,
  }),
  emailTrigger({
    key: 'email_sent',
    event: 'email.sent',
    label: 'Email Sent',
    description: 'Triggers when SendBeam sends an email: a campaign, an automation step or a single send.',
    extra: { kind: 'campaign' },
    extraFields: [{ key: 'kind', label: 'Kind' }],
  }),
  emailTrigger({
    key: 'email_delivered',
    event: 'email.delivered',
    label: 'Email Delivered',
    description: 'Triggers when an email is delivered to the recipient\'s mail server.',
    extra: occurred,
    extraFields: occurredField,
  }),
  makeHookTrigger({
    key: 'email_opened',
    noun: 'Email',
    label: 'Email Opened',
    description: 'Triggers when a recipient opens an email for the first time.',
    event: 'email.opened',
    filter: filters.campaign,
    sample: s.withEvent({ ...engagementSend, ...occurred }, 'ev_email_opened'),
    outputFields: [...s.sendOutputFields.filter((f) => f.key !== 'message_id'), ...occurredField, ...s.eventOutputFields],
  }),
  makeHookTrigger({
    key: 'email_clicked',
    noun: 'Email',
    label: 'Email Clicked',
    description: 'Triggers when a recipient clicks a link in an email for the first time.',
    event: 'email.clicked',
    filter: filters.campaign,
    sample: s.withEvent({ ...engagementSend, ...occurred, url: 'https://example.com/post' }, 'ev_email_clicked'),
    outputFields: [...s.sendOutputFields.filter((f) => f.key !== 'message_id'), ...occurredField, { key: 'url', label: 'Link' }, ...s.eventOutputFields],
  }),
  emailTrigger({
    key: 'email_bounced',
    event: 'email.bounced',
    label: 'Email Bounced',
    description: 'Triggers when an email bounces.',
    extra: { ...occurred, reason: 'The mailbox does not exist.', bounce_type: 'Permanent' },
    extraFields: [...occurredField, { key: 'reason', label: 'Reason' }, { key: 'bounce_type', label: 'Bounce Type' }],
  }),
  emailTrigger({
    key: 'email_complained',
    event: 'email.complained',
    label: 'Email Complained',
    description: 'Triggers when a recipient marks an email as spam.',
    extra: { ...occurred, reason: 'abuse' },
    extraFields: [...occurredField, { key: 'reason', label: 'Reason' }],
  }),
  makeHookTrigger({
    key: 'campaign_sent',
    noun: 'Campaign',
    label: 'Campaign Sent',
    description: 'Triggers when a campaign finishes sending to its whole audience, optionally only one particular campaign.',
    event: 'campaign.sent',
    filter: filters.campaign,
    performList: sentCampaigns,
    sample: s.withEvent({ campaign_id: s.IDS.campaign, name: 'September newsletter', sent_at: s.EVENT_AT, recipients: 1834, delivered: 1821, bounced: 13 }, 'ev_campaign_sent'),
    outputFields: [
      { key: 'campaign_id', label: 'Campaign ID' },
      { key: 'name', label: 'Name' },
      { key: 'sent_at', label: 'Sent At', type: 'datetime' },
      { key: 'recipients', label: 'Recipients', type: 'integer' },
      { key: 'delivered', label: 'Delivered', type: 'integer' },
      { key: 'bounced', label: 'Bounced', type: 'integer' },
      ...s.eventOutputFields,
    ],
  }),
  makeHookTrigger({
    key: 'form_submission',
    noun: 'Form Submission',
    label: 'New Form Submission',
    description: 'Triggers when someone submits one of your SendBeam forms (signup or contact), with every field they filled in.',
    event: 'form.submitted',
    filter: filters.form,
    sample: s.withEvent(
      {
        form_id: s.IDS.form,
        form_name: 'Homepage signup',
        form_kind: 'signup',
        submission_id: s.IDS.submission,
        contact_id: s.IDS.contact,
        email: 'ada@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        fields: { company: 'Analytical Engines' },
      },
      'ev_form_submission',
    ),
    outputFields: [
      { key: 'form_id', label: 'Form ID' },
      { key: 'form_name', label: 'Form Name' },
      { key: 'form_kind', label: 'Form Kind' },
      { key: 'submission_id', label: 'Submission ID' },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'name', label: 'Name (contact forms)' },
      { key: 'subject', label: 'Subject (contact forms)' },
      { key: 'message', label: 'Message (contact forms)' },
      { key: 'contact_id', label: 'Contact ID (signup forms)' },
      ...s.eventOutputFields,
    ],
  }),
  makeHookTrigger({
    key: 'domain_verified',
    noun: 'Sending Domain',
    label: 'Domain Verified',
    description: 'Triggers when a sending domain finishes verification and is ready to send.',
    event: 'domain.verified',
    sample: s.withEvent({ domain_id: s.IDS.domain, domain: 'mail.example.com', workspace_id: s.IDS.workspace, verified_at: s.EVENT_AT }, 'ev_domain_verified'),
    outputFields: [
      { key: 'domain_id', label: 'Domain ID' },
      { key: 'domain', label: 'Domain' },
      { key: 'workspace_id', label: 'Workspace ID' },
      { key: 'verified_at', label: 'Verified At', type: 'datetime' },
      ...s.eventOutputFields,
    ],
  }),
  makeHookTrigger({
    key: 'domain_failed',
    noun: 'Sending Domain',
    label: 'Domain Failed',
    description: 'Triggers when a sending domain fails verification or its verification lapses.',
    event: 'domain.failed',
    sample: s.withEvent({ domain_id: s.IDS.domain, domain: 'mail.example.com', workspace_id: s.IDS.workspace, reason: 'DNS verification failed. Check that every record is present and exact, then try again.' }, 'ev_domain_failed'),
    outputFields: [
      { key: 'domain_id', label: 'Domain ID' },
      { key: 'domain', label: 'Domain' },
      { key: 'workspace_id', label: 'Workspace ID' },
      { key: 'reason', label: 'Reason' },
      ...s.eventOutputFields,
    ],
  }),
];

/** The SendBeam event behind each trigger key, for tests. */
const EVENTS = {
  new_contact: 'contact.created',
  contact_updated: 'contact.updated',
  new_unsubscribe: 'contact.unsubscribed',
  contact_resubscribed: 'contact.resubscribed',
  contact_bounced: 'contact.bounced',
  contact_complained: 'contact.complained',
  contact_deleted: 'contact.deleted',
  tag_added: 'contact.tag_added',
  tag_removed: 'contact.tag_removed',
  new_list_member: 'contact.list_joined',
  list_member_removed: 'contact.list_left',
  email_sent: 'email.sent',
  email_delivered: 'email.delivered',
  email_opened: 'email.opened',
  email_clicked: 'email.clicked',
  email_bounced: 'email.bounced',
  email_complained: 'email.complained',
  campaign_sent: 'campaign.sent',
  form_submission: 'form.submitted',
  domain_verified: 'domain.verified',
  domain_failed: 'domain.failed',
};

/** Triggers whose test step loads real records from the account. */
const LISTED = triggers.filter((t) => t.operation.performList !== nothingToList).map((t) => t.key);

module.exports = { triggers, EVENTS, LISTED, filters };
