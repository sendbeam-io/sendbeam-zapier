# SendBeam for Zapier

The official [SendBeam](https://sendbeam.io) app for Zapier, built on the
[Zapier Platform CLI](https://github.com/zapier/zapier-platform). One connection per SendBeam workspace (one
workspace = one site), authenticated with an API key.

## Triggers (instant — webhooks, no polling)

| Trigger | Fires when | Fields |
| --- | --- | --- |
| **New Contact** | a contact is added — by a form, an import, the API or by hand | contact (id, email, status, names, source, custom fields, tags, dates) |
| **Contact Unsubscribed** | someone unsubscribes from a link, the preferences page or the API | contact |
| **Contact Added to List** | a contact joins a list; optional list filter | contact + `list.id`, `list.name` |
| **New Form Submission** | a signup or contact form is submitted; optional form filter | every field on the form + `form_id`, `form_name`, `form_kind`, `submission_id` |

Each subscription creates one webhook endpoint in the workspace (visible under Settings → Webhooks, named
"Zapier: …") and deletes it when the Zap is turned off. Deliveries are deduped on SendBeam's delivery id, so a
retried delivery never runs a Zap twice.

## Actions

| Action | Does | Needs on the key |
| --- | --- | --- |
| **Create or Update Contact** | adds the contact or updates the one with that email; optional list + tag; re-subscribe is off unless you turn it on | `contacts:write` |
| **Add Contact to List** | adds to a list, creating the contact first if new | `contacts:write` |
| **Add Tag to Contact** | tags an existing contact | `contacts:write` |
| **Send Email** | one transactional email to a subscribed contact, from the workspace's sending domain; `{{first_name}}`-style merge tags work | `campaigns:write` |
| **Find Contact** (search) | by email | `contacts:read` |

Lists and tags are dropdowns, loaded from the workspace.

## Permissions on the API key

Make the key under **Settings → API keys** in the workspace the Zap is about. Triggers need `contacts:read` and
`webhooks:write`; actions need what the table says. A key without a permission gets a clear error in the Zap's
task history rather than a silent no-op.

API writes and sending are a paid SendBeam feature (Pro and above); triggers and the search work on every plan.

## Development

```bash
npm install
npm test                     # jest + nock, no network
npm run validate             # Zapier schema + integration checks
```

`SENDBEAM_API_BASE` overrides the API origin for a self-hosted or staging SendBeam (default
`https://sendbeam.io/api/v1`).

One thing to know when adding an action: Zapier's request client blanks any `{{curly}}` text it finds in an
object body, treating it as an unresolved Zap field. `jsonBody()` in `src/api.js` pre-serialises the body so
SendBeam merge tags survive; use it for anything that carries user-written email content.

## Licence

MIT. See [LICENSE](LICENSE).
