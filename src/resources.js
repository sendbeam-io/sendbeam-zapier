'use strict';

/**
 * Dropdown sources. Each resource's `list` becomes a hidden trigger that
 * fields use as `dynamic: '<key>.id.name'`.
 */

const { getAll, listAll } = require('./api');
const samples = require('./triggers/samples');

const dropdown = ({ key, noun, label, sample, load }) => ({
  key,
  noun,
  list: {
    display: { label, description: `Triggers when a ${noun.toLowerCase()} is added. Used to fill dropdowns.`, hidden: true },
    operation: {
      perform: async (z) => (await load(z)).map((row) => ({ id: row.id, name: row.name })),
      sample: { id: sample.id, name: sample.name },
    },
  },
});

const list = dropdown({ key: 'list', noun: 'List', label: 'New List', sample: samples.sampleList, load: (z) => getAll(z, '/lists', 'lists', 'Listing lists') });
const tag = dropdown({ key: 'tag', noun: 'Tag', label: 'New Tag', sample: samples.sampleTag, load: (z) => getAll(z, '/tags', 'tags', 'Listing tags') });
const form = dropdown({ key: 'form', noun: 'Form', label: 'New Form', sample: { id: samples.IDS.form, name: 'Homepage signup' }, load: (z) => getAll(z, '/forms', 'forms', 'Listing forms') });
const campaign = dropdown({ key: 'campaign', noun: 'Campaign', label: 'New Campaign', sample: samples.sampleCampaign, load: (z) => listAll(z, '/campaigns', 'campaigns', {}, 'Listing campaigns') });
const segment = dropdown({ key: 'segment', noun: 'Segment', label: 'New Segment', sample: { id: samples.IDS.segment, name: 'Opened in the last 30 days' }, load: (z) => getAll(z, '/segments', 'segments', 'Listing segments') });
const automation = dropdown({ key: 'automation', noun: 'Automation', label: 'New Automation', sample: { id: samples.IDS.automation, name: 'Welcome series' }, load: (z) => getAll(z, '/automations', 'automations', 'Listing automations') });

module.exports = { list, tag, form, campaign, segment, automation };
