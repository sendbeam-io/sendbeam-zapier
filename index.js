'use strict';

const { version: packageVersion } = require('./package.json');
const zapier = require('zapier-platform-core');

const authentication = require('./src/authentication');
const { includeApiKey } = require('./src/middleware');
const resources = require('./src/resources');
const { triggers } = require('./src/triggers');
const contactCreates = require('./src/creates/contacts');
const emailCreates = require('./src/creates/email');
const campaignCreates = require('./src/creates/campaigns');
const workspaceCreates = require('./src/creates/workspace');
const searches = require('./src/searches');

const byKey = (items) => Object.fromEntries(items.map((item) => [item.key, item]));

const searchOrCreate = (search, create, label) => ({
  key: search,
  display: { label, description: `${label}: finds it first, and creates it when it does not exist.` },
  search,
  create,
});

module.exports = {
  version: packageVersion,
  platformVersion: zapier.version,
  authentication,
  beforeRequest: [includeApiKey],
  // Input data reaches perform as entered: empty values are handled in the
  // actions, and nothing is stripped from email content.
  flags: { cleanInputData: false },
  resources: byKey(Object.values(resources)),
  triggers: byKey(triggers),
  creates: byKey([
    ...Object.values(contactCreates),
    ...Object.values(emailCreates),
    ...Object.values(campaignCreates),
    ...Object.values(workspaceCreates),
  ]),
  searches: byKey(Object.values(searches)),
  searchOrCreates: byKey([
    searchOrCreate('find_contact', 'create_contact', 'Find or Create Contact'),
    searchOrCreate('find_list', 'create_list', 'Find or Create List'),
    searchOrCreate('find_tag', 'create_tag', 'Find or Create Tag'),
  ]),
};
