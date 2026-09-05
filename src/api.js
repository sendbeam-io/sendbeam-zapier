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

/** Fetch one contact by email, or null. */
const findContactByEmail = async (z, email) => {
  const response = await z.request({ url: `${BASE_URL}/contacts`, params: { q: email, limit: 5 }, skipThrowForStatus: true });
  check(z, response, 'Looking up the contact');
  const wanted = String(email).trim().toLowerCase();
  return (response.data.contacts || []).find((c) => String(c.email).toLowerCase() === wanted) || null;
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
 * A JSON body that reaches SendBeam byte-for-byte. Zapier's request client
 * treats "{{...}}" inside object bodies as unresolved Zap fields and blanks
 * them, which would strip SendBeam merge tags such as {{first_name}} from a
 * subject or an email body. A pre-serialised string is left alone.
 */
const jsonBody = (body) => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

module.exports = { BASE_URL, UUID, check, errorMessage, findContactByEmail, createOrFindContact, jsonBody };
