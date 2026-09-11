# SendBeam for Zapier

[![Verify app](https://github.com/sendbeam-io/sendbeam-zapier/actions/workflows/verify.yml/badge.svg)](https://github.com/sendbeam-io/sendbeam-zapier/actions/workflows/verify.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

The official [SendBeam](https://sendbeam.io) app for Zapier, built on the
[Zapier Platform CLI](https://github.com/zapier/zapier-platform). One connection per SendBeam workspace (one
workspace = one site), authenticated with an API key.

The app is in review with Zapier. Until it is public, it is shared by invitation; ask at
<https://sendbeam.io/contact>. What it does is below, and [sendbeam.io/integrations/zapier](https://sendbeam.io/integrations/zapier)
puts it in context.

## Getting started

1. **Create an API key.** In SendBeam, open **Settings → API keys** in the workspace the Zap is about, and tick
   the permissions the tables below ask for. The full key is shown once.
2. **Connect it in Zapier.** Add a SendBeam step to a Zap, choose **Connect a new account** and paste the key.
   The connection is named after the key, so several workspaces stay apart.
3. **Pick a trigger or an action**, test it, and turn the Zap on. Each live trigger adds one webhook endpoint to
   the workspace, listed under **Settings → Webhooks**, and removes it when the Zap is turned off.

## Triggers

Every trigger is instant: a SendBeam webhook, not polling. Testing a trigger in the Zap editor loads the
workspace's latest real events of that type, the ones SendBeam has sent to any of its webhooks, in exactly the
shape a live Zap receives. Until there are some, the contact, tag, list and campaign triggers that can show real
records from the workspace do, and the rest show a sample.

| Trigger | Fires when | Filter |
| --- | --- | --- |
| **New Contact** | a contact is added, by a form, an import, the API or by hand | |
| **Contact Updated** | a contact's details change | |
| **Contact Unsubscribed** | a contact unsubscribes | |
| **Contact Resubscribed** | a contact who had unsubscribed subscribes again | |
| **Contact Bounced** | a contact's address bounces and is no longer emailed | |
| **Contact Complained** | a contact marks an email as spam and is no longer emailed | |
| **Contact Deleted** | a contact is deleted | |
| **Tag Added to Contact** | a tag is added to a contact | tag |
| **Tag Removed From Contact** | a tag is removed from a contact | tag |
| **Contact Added to List** | a contact joins a list (on a double opt-in list, when they confirm) | list |
| **Contact Removed From List** | a contact leaves or is removed from a list | list |
| **Email Sent** | an email is sent: a campaign, an automation step or a single send | campaign |
| **Email Delivered** | an email reaches the recipient's mail server | campaign |
| **Email Opened** | a recipient opens an email for the first time | campaign |
| **Email Clicked** | a recipient clicks a link in an email for the first time | campaign |
| **Email Bounced** | an email bounces | campaign |
| **Email Complained** | a recipient marks an email as spam | campaign |
| **Campaign Sent** | a campaign finishes sending to its whole audience | campaign |
| **New Form Submission** | a signup or contact form is submitted, with every field | form |

Contact triggers give the contact's fields at the top level (id, email, status, names, source, custom fields,
tags, dates), plus `list` or `tag` on the list and tag triggers. A filter is optional; when one is chosen, SendBeam
only sends that list's, tag's, campaign's or form's events to the Zap.

Each Zap creates one webhook endpoint in the workspace (listed under Settings → Webhooks as "Zapier: …") and
removes it when the Zap is turned off. Deliveries are deduped on SendBeam's delivery id, so a retried delivery
never runs a Zap twice.

## Actions

| Action | Does | Permissions |
| --- | --- | --- |
| **Create or Update Contact** | adds the contact or updates the one with that email; custom fields are merged; optional list and tag; re-subscribing is off unless turned on | `contacts:read`, `contacts:write` (+ `lists:write`, `tags:read`, `tags:write`) |
| **Update Contact** | changes an existing contact's email, name or custom fields | `contacts:read`, `contacts:write` |
| **Unsubscribe Contact** | stops marketing email to a contact | `contacts:read`, `contacts:write` |
| **Delete Contact** | deletes a contact | `contacts:read`, `contacts:write` |
| **Add Contact to List** | adds to a list, creating the contact first if new | `contacts:read`, `contacts:write`, `lists:write` |
| **Remove Contact From List** | takes a contact off a list | `contacts:read`, `lists:write` |
| **Add Tag to Contact** | tags a contact; a tag name the workspace does not have is created | `contacts:read`, `tags:read`, `tags:write` |
| **Remove Tag From Contact** | removes a tag, by dropdown or name | `contacts:read`, `tags:read`, `tags:write` |
| **Send Email to Contact** | one email to a subscribed contact; `{{first_name}}`-style merge tags work | `contacts:read`, `campaigns:write` |
| **Send Transactional Email** | a receipt, reset or other requested email to any address, with CC/BCC | `transactional:send` |
| **Create Campaign** | a draft for all subscribed contacts, a list or a segment | `campaigns:write` |
| **Send Campaign** | sends a draft now, or schedules it | `campaigns:write` |
| **Duplicate Campaign** | copies a campaign, optionally to the people who did not open it | `campaigns:write` |
| **Delete Campaign** | deletes a draft or cancelled campaign | `campaigns:write` |
| **Start Automation for Contact** | starts an active automation with an API trigger | `automations:write` |
| **Create List** | creates a list | `lists:write` |
| **Create Tag** | creates a tag | `tags:write` |

## Searches

| Search | Finds | Permissions |
| --- | --- | --- |
| **Find Contact** | a contact by email (with Find or Create) | `contacts:read` |
| **Find List** | a list by name (with Find or Create) | `lists:read` |
| **Find Tag** | a tag by name (with Find or Create) | `tags:read` |
| **Find Campaign** | a campaign by name, optionally by status | `campaigns:read` |
| **Get Campaign Report** | a campaign's opens, clicks, links, email clients and devices | `campaigns:read` |

Lists, tags, forms, campaigns, segments and automations are dropdowns, loaded from the workspace. Tags can also be
typed or mapped by name.

## Permissions on the API key

Make the key under **Settings → API keys** in the workspace the Zap is about. Connecting needs `contacts:read`;
triggers need `webhooks:write`, and `webhooks:read` to load recent events when you test one; actions and searches
need what the tables say. A key without a permission gets a
clear error in the Zap's history rather than a silent no-op.

## Development

```bash
npm install
npm test                     # jest: unit tests (mocked API) and the contract test
npm run validate             # Zapier schema, integration and style checks
```

`test/contract.test.js` runs every trigger, action, search and dropdown against a stand-in API and checks each
request against [SendBeam's API description](https://sendbeam.io/openapi.json): documented paths, methods, body
fields and query parameters only, and every webhook event SendBeam sends apart from the sending-domain ones. It
needs network access to fetch the description; set `SENDBEAM_OPENAPI_URL` to check against another copy.

`SENDBEAM_API_BASE` overrides the API origin for a staging SendBeam (default `https://sendbeam.io/api/v1`).

One thing to know when adding an action: Zapier's request client blanks any `{{curly}}` text it finds in an
object body, treating it as an unresolved Zap field. `jsonBody()` in `src/api.js` pre-serialises the body so
SendBeam merge tags survive; use it for anything that carries user-written email content.

## Support

| What | Where |
| --- | --- |
| A bug in this app | [Open an issue](https://github.com/sendbeam-io/sendbeam-zapier/issues/new/choose) |
| SendBeam itself: your account, pricing, deliverability, the API | <https://sendbeam.io/contact> |
| Zapier itself: building Zaps, task history, billing | <https://help.zapier.com> |
| Something exploitable | [SECURITY.md](SECURITY.md) — never a public issue |

## Contributing

Pull requests are welcome; please open an issue first for anything beyond a typo. [CONTRIBUTING.md](CONTRIBUTING.md)
covers how to run the tests and the house style, and everyone is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md). What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT. See [LICENSE](LICENSE).
