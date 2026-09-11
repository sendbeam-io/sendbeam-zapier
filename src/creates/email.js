'use strict';

const { BASE_URL, check, text, requireContact, splitAddresses, jsonBody } = require('../api');
const s = require('../triggers/samples');

/**
 * One email to one subscribed contact, through the workspace's sending
 * domain. Merge tags such as {{first_name}} work in the subject and body.
 */
const send_email = {
  key: 'send_email',
  noun: 'Email',
  display: {
    label: 'Send Email to Contact',
    description: 'Sends an email to a subscribed contact from your workspace\'s sending domain. Unsubscribed contacts are never mailed. Needs contacts:read and campaigns:write.',
  },
  operation: {
    perform: async (z, bundle) => {
      const { email, subject, html_content, text_content } = bundle.inputData;
      const contact = await requireContact(z, email);
      const body = { contact_id: contact.id, subject, html_content };
      if (text(text_content)) body.text_content = text_content;
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/send`, ...jsonBody(body), skipThrowForStatus: true });
      check(z, response, 'Sending the email');
      const data = response.data || {};
      return { ok: data.ok !== false, message_id: data.message_id || null, contact_id: contact.id, email: contact.email };
    },
    inputFields: [
      { key: 'email', label: 'To', required: true, type: 'string', helpText: 'The email address of a subscribed contact in this workspace.' },
      { key: 'subject', label: 'Subject', required: true, type: 'string' },
      { key: 'html_content', label: 'HTML Content', required: true, type: 'text', helpText: 'Merge tags such as {{first_name}} are filled in for the contact.' },
      { key: 'text_content', label: 'Text Content', required: false, type: 'text', helpText: 'A plain-text version of the email. Worth sending: some mail clients and filters prefer it.' },
    ],
    sample: { ok: true, message_id: 'msg_5f8b2c0a9d1e', contact_id: s.IDS.contact, email: 'ada@example.com' },
    outputFields: [
      { key: 'ok', label: 'Sent', type: 'boolean' },
      { key: 'message_id', label: 'Message ID' },
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'email', label: 'Email' },
    ],
  },
};

/**
 * Mail a person asked for (receipts, password resets, booking reminders), to
 * any address. Addresses that bounced or marked mail as spam are skipped.
 */
const send_transactional = {
  key: 'send_transactional',
  noun: 'Email',
  display: {
    label: 'Send Transactional Email',
    description: 'Sends a receipt, password reset or other email a person asked for, to any address. Needs transactional:send.',
  },
  operation: {
    perform: async (z, bundle) => {
      const input = bundle.inputData;
      const to = splitAddresses(input.to);
      if (!to.length) throw new z.errors.Error('Add at least one recipient.', 'MissingRecipient', 400);
      const body = { to: to.length === 1 ? to[0] : to, subject: input.subject, html: input.html };
      if (text(input.text)) body.text = input.text;
      for (const key of ['cc', 'bcc']) {
        const addresses = splitAddresses(input[key]);
        if (addresses.length) body[key] = addresses;
      }
      for (const key of ['from_name', 'from_email', 'reply_to']) if (text(input[key])) body[key] = text(input[key]);
      const response = await z.request({ method: 'POST', url: `${BASE_URL}/transactional`, ...jsonBody(body), skipThrowForStatus: true });
      check(z, response, 'Sending the email');
      const data = response.data || {};
      const sent = data.sent || [];
      return {
        ok: data.ok !== false,
        message_id: (sent[0] && sent[0].message_id) || null,
        sent_count: sent.length,
        failed_count: (data.failed || []).length,
        skipped_count: (data.skipped || []).length,
        sent,
        failed: data.failed || [],
        skipped: data.skipped || [],
      };
    },
    inputFields: [
      { key: 'to', label: 'To', required: true, type: 'string', list: true, helpText: 'One or more email addresses. They do not need to be contacts.' },
      { key: 'subject', label: 'Subject', required: true, type: 'string' },
      { key: 'html', label: 'HTML Content', required: true, type: 'text' },
      { key: 'text', label: 'Text Content', required: false, type: 'text', helpText: 'A plain-text version of the email.' },
      { key: 'from_name', label: 'From Name', required: false, type: 'string' },
      { key: 'from_email', label: 'From Email', required: false, type: 'string', helpText: 'Used only when it is on a domain verified in this workspace; otherwise the workspace sender is used.' },
      { key: 'reply_to', label: 'Reply To', required: false, type: 'string' },
      { key: 'cc', label: 'CC', required: false, type: 'string', list: true },
      { key: 'bcc', label: 'BCC', required: false, type: 'string', list: true },
    ],
    sample: {
      ok: true,
      message_id: 'msg_5f8b2c0a9d1e',
      sent_count: 1,
      failed_count: 0,
      skipped_count: 0,
      sent: [{ to: 'ada@example.com', message_id: 'msg_5f8b2c0a9d1e' }],
      failed: [],
      skipped: [],
    },
    outputFields: [
      { key: 'ok', label: 'Sent', type: 'boolean' },
      { key: 'message_id', label: 'Message ID (First Recipient)' },
      { key: 'sent_count', label: 'Sent Count', type: 'integer' },
      { key: 'failed_count', label: 'Failed Count', type: 'integer' },
      { key: 'skipped_count', label: 'Skipped Count', type: 'integer' },
    ],
  },
};

module.exports = { send_email, send_transactional };
