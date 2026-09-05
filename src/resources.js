'use strict';

/**
 * Lists and tags as resources, so actions can offer them as dropdowns
 * (`dynamic: 'list.id.name'`).
 */

const { BASE_URL, check } = require('./api');

const list = {
  key: 'list',
  noun: 'List',
  list: {
    display: { label: 'New List', description: 'Triggers when a list is created.', hidden: true },
    operation: {
      perform: async (z) => {
        const response = await z.request({ url: `${BASE_URL}/lists`, skipThrowForStatus: true });
        check(z, response, 'Listing lists');
        return (response.data.lists || []).map((l) => ({ id: l.id, name: l.name }));
      },
      sample: { id: '9c2b1a0f-1111-4222-8333-444455556666', name: 'Product updates' },
    },
  },
};

const tag = {
  key: 'tag',
  noun: 'Tag',
  list: {
    display: { label: 'New Tag', description: 'Triggers when a tag is created.', hidden: true },
    operation: {
      perform: async (z) => {
        const response = await z.request({ url: `${BASE_URL}/tags`, skipThrowForStatus: true });
        check(z, response, 'Listing tags');
        return (response.data.tags || []).map((t) => ({ id: t.id, name: t.name }));
      },
      sample: { id: '5d6e7f80-2222-4333-8444-555566667777', name: 'customer' },
    },
  },
};

const form = {
  key: 'form',
  noun: 'Form',
  list: {
    display: { label: 'New Form', description: 'Triggers when a form is created.', hidden: true },
    operation: {
      perform: async (z) => {
        const response = await z.request({ url: `${BASE_URL}/forms`, skipThrowForStatus: true });
        check(z, response, 'Listing forms');
        return (response.data.forms || []).map((f) => ({ id: f.id, name: f.name }));
      },
      sample: { id: '8f3c1a2e-3b1d-4c55-9a0e-1f2d3c4b5a69', name: 'Homepage signup' },
    },
  },
};

module.exports = { list, tag, form };
