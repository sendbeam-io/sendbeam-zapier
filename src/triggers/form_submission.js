'use strict';

const { makeHookTrigger } = require('./hooks');

// Form submissions are not listable through the API, so the editor gets the sample below.
module.exports = makeHookTrigger({
  key: 'form_submission',
  noun: 'Form submission',
  label: 'New Form Submission',
  description: 'Triggers when someone submits one of your SendBeam forms (signup or contact), with every field they filled in.',
  event: 'form.submitted',
  inputFields: [
    {
      key: 'form_id',
      label: 'Form',
      required: false,
      dynamic: 'form.id.name',
      helpText: 'Leave empty to trigger for every form. The dropdown needs forms:read on the key; you can also paste a form ID from SendBeam → Forms → your form → Embed.',
    },
  ],
  keep: (data, bundle) => !bundle.inputData.form_id || data.form_id === String(bundle.inputData.form_id).trim().toLowerCase(),
  sample: {
    form_id: '8f3c1a2e-3b1d-4c55-9a0e-1f2d3c4b5a69',
    form_name: 'Homepage signup',
    form_kind: 'signup',
    submission_id: 'b1d2c3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d',
    email: 'ada@example.com',
    first_name: 'Ada',
    contact_id: '3f0e2b6e-9a11-4d7a-8c3c-2f2b4b1c9d10',
    event_id: 'ev_9c4f5e6d',
    event_at: '2026-09-05T09:12:00.000Z',
  },
  outputFields: [
    { key: 'form_id', label: 'Form ID' },
    { key: 'form_name', label: 'Form name' },
    { key: 'form_kind', label: 'Form kind' },
    { key: 'submission_id', label: 'Submission ID' },
    { key: 'email', label: 'Email' },
    { key: 'event_id', label: 'Event ID' },
    { key: 'event_at', label: 'Event time', type: 'datetime' },
  ],
  performList: async () => [],
});
