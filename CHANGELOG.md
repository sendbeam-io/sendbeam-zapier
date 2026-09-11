# Changelog

Notable changes to the SendBeam app for Zapier. The versions here are the versions uploaded to Zapier; existing
Zaps are moved to each new one.

## 1.2.1 — 2026-09-11

### Fixed

- Zaps and connections left on 1.1.0 can move to the current version. A version cannot drop a trigger an earlier
  one had, so **Domain Verified** and **Domain Failed** are back as hidden triggers: Zaps that already use them
  keep working, and new Zaps cannot choose them.
- **Email Complained** no longer lists a Reason field, which SendBeam's complaint events do not carry.

## 1.2.0 — 2026-09-11

### Changed

- Testing a trigger in the Zap editor loads the workspace's latest real events of that type, in the shape a live
  Zap receives and with the Zap's filter applied. Until there are any, the contact, tag, list and campaign
  triggers show real records from the workspace, and the rest show a sample.
- A key without `webhooks:read` falls back to those records or the sample instead of failing the test.

### Removed

- The **Domain Verified** and **Domain Failed** triggers. Those events are still available through SendBeam's own
  webhooks. (Restored as hidden triggers in 1.2.1 so Zaps could migrate.)

## 1.1.0 — 2026-09-11

### Added

- An instant trigger for every SendBeam event, each with an optional list, tag, campaign or form filter that
  SendBeam applies when the Zap subscribes and again on delivery.
- Actions: update, unsubscribe and delete contacts; remove a contact from a list; remove a tag; add a tag by
  name, created if the workspace does not have it; send transactional email; create, send, duplicate and delete
  campaigns; start an automation; create lists and tags.
- Searches: find a list, tag or campaign, and get a campaign report. Find or create for contacts, lists and tags.
- Dropdowns for campaigns, segments and automations.
- A contract test that runs every trigger, action, search and dropdown and checks each request against
  SendBeam's published API description.

### Changed

- **Send Email to Contact** returns SendBeam's own response.

## 1.0.1 — 2026-09-11

### Fixed

- Contact triggers give the contact's fields at the top level on live events, as the Zap editor's sample always
  did. Fields mapped from the sample, such as Email and First name, arrived empty on real events.

## 1.0.0 — 2026-09-05

First version: instant triggers for new contacts, unsubscribes, contacts added to a list and form submissions;
actions to create or update a contact, add a contact to a list, add a tag and send an email; and a contact
search.
