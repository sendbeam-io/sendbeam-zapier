'use strict';

const { BASE_URL, check } = require('./api');

/**
 * The first part of a key (`sb_live_` and its eight lookup characters), so
 * someone with several connected workspaces can tell them apart. The secret
 * part of the key is never shown.
 */
const keyHint = (key) => {
  const parts = String(key || '').split('_');
  return parts.length >= 3 ? parts.slice(0, 3).join('_') : 'API key';
};

// A SendBeam API key is made under Settings → API keys, per workspace (one
// workspace = one site). The key carries the permissions chosen when it was
// made; the test call below only needs contacts:read.
const test = async (z, bundle) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { limit: 1 }, skipThrowForStatus: true });
  check(z, response, 'Checking the API key');
  return { ok: true, key_hint: keyHint(bundle.authData.api_key) };
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText:
        'Make one at [Settings → API keys](https://sendbeam.io/settings/api-keys) in the workspace for the site this Zap is about, and give it the permissions your Zaps use: contacts:read for the connection test, webhooks:write for triggers, and each action lists what it needs. See the [API docs](https://sendbeam.io/docs/api).',
    },
  ],
  test,
  connectionLabel: 'SendBeam ({{bundle.inputData.key_hint}})',
};
