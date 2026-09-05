'use strict';

const { BASE_URL, check } = require('./api');

// A SendBeam API key is made under Settings → API keys, per workspace (one
// workspace = one site). The key carries the permissions chosen when it was
// made; the test call below only needs contacts:read.
const test = async (z) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { limit: 1 }, skipThrowForStatus: true });
  check(z, response, 'Checking the API key');
  return { ok: true };
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API key',
      required: true,
      type: 'password',
      helpText: 'Make one at [Settings → API keys](https://sendbeam.io/settings/api-keys) in the workspace for the site this Zap is about. Triggers need contacts:read and webhooks:write; actions need contacts:write (and campaigns:write to send email). See the [API docs](https://sendbeam.io/docs/api).',
    },
  ],
  test,
  connectionLabel: 'SendBeam workspace',
};
