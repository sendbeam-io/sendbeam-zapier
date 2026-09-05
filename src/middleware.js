'use strict';

/** Add the workspace API key and a user agent to every request. */
const includeApiKey = (request, z, bundle) => {
  request.headers = request.headers || {};
  if (bundle.authData && bundle.authData.api_key) {
    request.headers['x-api-key'] = bundle.authData.api_key;
  }
  request.headers['User-Agent'] = 'SendBeam-Zapier/1.0';
  return request;
};

module.exports = { includeApiKey };
