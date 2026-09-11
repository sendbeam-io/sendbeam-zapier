'use strict';

/**
 * Shared request helpers. Every call goes through z.request with the key
 * added by the beforeRequest middleware in index.js; the helpers here
 * turn SendBeam's `{ error }` bodies into messages Zapier shows the user.
 */

const BASE_URL = process.env.SENDBEAM_API_BASE || 'https://sendbeam.io/api/v1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read the error string SendBeam puts in every non-2xx body. */
const errorMessage = (response, fallback) => {
  const body = response.data || {};
  return (body && typeof body.error === 'string' && body.error) || fallback;
};

/** Throw the right Zapier error for a failed response; return it otherwise. */
const check = (z, response, what) => {
  if (response.status < 400) return response;
  const msg = errorMessage(response, `${what} failed with HTTP ${response.status}`);
  if (response.status === 401) throw new z.errors.RefreshAuthError(msg);
  if (response.status === 403) throw new z.errors.Error(`${msg} (the API key needs a permission it does not have — check Settings → API keys in SendBeam)`, 'Forbidden', 403);
  if (response.status === 429) throw new z.errors.ThrottledError(msg, 60);
  throw new z.errors.Error(msg, 'SendBeamError', response.status);
};

/** A value someone actually filled in. Input data is not cleaned (see flags in index.js). */
const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const text = (value) => (has(value) ? String(value).trim() : undefined);
/** Zapier hands booleans over as true/false or as the strings "true"/"false". */
const yes = (value) => value === true || String(value).toLowerCase() === 'true';

/**
 * Every row of a paged list endpoint. The page size parameter is `limit`, and
 * paging follows the `pagination` envelope rather than guessing the last page
 * from a short one.
 */
const listAll = async (z, path, collection, params = {}, what = 'Listing') => {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await z.request({ url: `${BASE_URL}${path}`, params: { ...params, page, limit: 100 }, skipThrowForStatus: true });
    check(z, response, what);
    rows.push(...(response.data[collection] || []));
    const pagination = response.data.pagination;
    if (!pagination) break;
    totalPages = Number(pagination.total_pages) || 1;
    page += 1;
  } while (page <= totalPages && page <= 50);
  return rows;
};

/** An endpoint that returns its whole collection in one response (lists, tags, forms, segments, automations). */
const getAll = async (z, path, collection, what = 'Listing') => {
  const response = await z.request({ url: `${BASE_URL}${path}`, skipThrowForStatus: true });
  check(z, response, what);
  return response.data[collection] || [];
};

/**
 * The contact with exactly this email address, or null. `q` matches part of
 * an address or name, so `jo@example.com` also finds `mojo@example.com`; the
 * exact match is picked here. SendBeam stores addresses lowercased.
 */
const findContactByEmail = async (z, email) => {
  const wanted = String(email || '').trim().toLowerCase();
  if (!wanted) return null;
  const rows = await listAll(z, '/contacts', 'contacts', { q: wanted }, 'Looking up the contact');
  return rows.find((c) => String(c.email).toLowerCase() === wanted) || null;
};

/** The contact an action works on; a clear error when the address is not in the workspace. */
const requireContact = async (z, email) => {
  if (!has(email)) throw new z.errors.Error('Map an email address to find the contact by.', 'MissingEmail', 400);
  const contact = await findContactByEmail(z, email);
  if (!contact) {
    throw new z.errors.Error(`No contact with the email ${String(email).trim()} in this workspace. To add them, use Create or Update Contact first.`, 'NotFound', 404);
  }
  return contact;
};

/**
 * Create the contact, or return the existing one when SendBeam answers 409.
 * `fields` are the optional attributes to set on a new contact.
 */
const createOrFindContact = async (z, email, fields = {}) => {
  const body = { email: String(email).trim(), ...fields };
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/contacts`, body, skipThrowForStatus: true });
  if (response.status === 409) {
    const existing = await findContactByEmail(z, email);
    if (existing) return { contact: existing, created: false };
  }
  check(z, response, 'Creating the contact');
  return { contact: response.data.contact || response.data, created: true };
};

/**
 * A tag's ID from the dropdown, or from a name typed or mapped into it. A name
 * matches regardless of case and, when adding, is created if the workspace
 * does not have it yet.
 */
const resolveTagId = async (z, value, createIfMissing) => {
  const wanted = text(value);
  if (!wanted) throw new z.errors.Error('Choose a tag, or map a tag name.', 'MissingTag', 400);
  if (UUID.test(wanted)) return wanted;
  const tags = await getAll(z, '/tags', 'tags', 'Listing tags');
  const found = tags.find((t) => String(t.name).toLowerCase() === wanted.toLowerCase());
  if (found) return found.id;
  if (!createIfMissing) throw new z.errors.Error(`No tag called "${wanted}" in this workspace.`, 'NotFound', 404);
  const response = await z.request({ method: 'POST', url: `${BASE_URL}/tags`, body: { name: wanted }, skipThrowForStatus: true });
  check(z, response, 'Creating the tag');
  return (response.data.tag || response.data).id;
};

/** Custom fields from a Zapier dict field, or undefined when none were set. */
const customFields = (dict) => {
  if (!dict || typeof dict !== 'object') return undefined;
  const out = {};
  for (const [key, value] of Object.entries(dict)) if (key.trim()) out[key.trim()] = value;
  return Object.keys(out).length ? out : undefined;
};

/** Addresses from a list field or a comma-separated string. */
const splitAddresses = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((a) => String(a).trim())
    .filter(Boolean);

/**
 * A JSON body that reaches SendBeam byte-for-byte. Zapier's request client
 * treats "{{...}}" inside object bodies as unresolved Zap fields and blanks
 * them, which would strip SendBeam merge tags such as {{first_name}} from a
 * subject or an email body. A pre-serialised string is left alone.
 */
const jsonBody = (body) => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

module.exports = {
  BASE_URL,
  UUID,
  check,
  errorMessage,
  has,
  text,
  yes,
  listAll,
  getAll,
  findContactByEmail,
  requireContact,
  createOrFindContact,
  resolveTagId,
  customFields,
  splitAddresses,
  jsonBody,
};
