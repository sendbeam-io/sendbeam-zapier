'use strict';

const { BASE_URL, check, findContactByEmail, jsonBody } = require('../api');

/**
 * One transactional email to one subscribed contact, through the
 * workspace's sending domain. Merge tags such as {{first_name}} work in the
 * subject and body. Needs campaigns:write on the key.
 */
const perform = async (z, bundle) => {
  const { email, subject, html_content, text_content } = bundle.inputData;
  const contact = await findContactByEmail(z, email);
  if (!contact) throw new z.errors.Error(`No contact with the email ${email} in this workspace — add them first with "Create or Update Contact".`, 'NotFound', 404);
  const body = { contact_id: contact.id, subject, html_content };
  if (text_content) body.text_content = text_content;
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/send`, ...jsonBody(body), skipThrowForStatus: true });
  check(z, response, 'Sending the email');
  const data = response.data || {};
  return { contact_id: contact.id, email: contact.email, subject, send_id: data.send_id || data.id || null, status: data.status || 'queued' };
};

module.exports = {
  key: 'send_email',
  noun: 'Email',
  display: { label: 'Send Email', description: 'Sends one email to a subscribed contact from your workspace\'s sending domain. Counts against your monthly emails.' },
  operation: {
    perform,
    inputFields: [
      { key: 'email', label: 'To (contact email)', required: true, type: 'string', helpText: 'Must already be a subscribed contact in this workspace.' },
      { key: 'subject', label: 'Subject', required: true, type: 'string' },
      { key: 'html_content', label: 'HTML body', required: true, type: 'text', helpText: 'Merge tags like {{first_name}} are filled in. An unsubscribe link is added if the body has none.' },
      { key: 'text_content', label: 'Plain-text body', required: false, type: 'text' },
    ],
    sample: { contact_id: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10', email: 'ada@example.com', subject: 'Your receipt', send_id: 'c0ffee00-1111-4222-8333-444455556666', status: 'queued' },
    outputFields: [
      { key: 'send_id', label: 'Send ID' },
      { key: 'status', label: 'Status' },
      { key: 'contact_id', label: 'Contact ID' },
    ],
  },
};
