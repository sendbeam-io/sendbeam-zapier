'use strict';

const { version: packageVersion } = require('./package.json');
const zapier = require('zapier-platform-core');

const authentication = require('./src/authentication');
const { includeApiKey } = require('./src/middleware');
const resources = require('./src/resources');
const newContact = require('./src/triggers/new_contact');
const newUnsubscribe = require('./src/triggers/new_unsubscribe');
const newListMember = require('./src/triggers/new_list_member');
const formSubmission = require('./src/triggers/form_submission');
const createContact = require('./src/creates/create_contact');
const addToList = require('./src/creates/add_to_list');
const addTag = require('./src/creates/add_tag');
const sendEmail = require('./src/creates/send_email');
const findContact = require('./src/searches/find_contact');

module.exports = {
  version: packageVersion,
  platformVersion: zapier.version,
  authentication,
  beforeRequest: [includeApiKey],
  resources: {
    [resources.list.key]: resources.list,
    [resources.tag.key]: resources.tag,
    [resources.form.key]: resources.form,
  },
  triggers: {
    [newContact.key]: newContact,
    [newUnsubscribe.key]: newUnsubscribe,
    [newListMember.key]: newListMember,
    [formSubmission.key]: formSubmission,
  },
  creates: {
    [createContact.key]: createContact,
    [addToList.key]: addToList,
    [addTag.key]: addTag,
    [sendEmail.key]: sendEmail,
  },
  searches: {
    [findContact.key]: findContact,
  },
};
