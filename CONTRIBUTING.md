# Contributing

Thanks for looking. This is the official SendBeam app for Zapier: instant triggers for SendBeam's events, and the
actions and searches a Zap needs. Changes that keep it focused are much easier to accept than changes that grow
it.

## Before you start

For anything beyond a typo, **open an issue first**. It is a short conversation and it saves you writing
something we then ask you to change. If you are not sure whether an idea fits, ask — the answer is often yes
with a different shape.

Questions about SendBeam itself — your account, plans, the API, deliverability — are better at
<https://sendbeam.io/contact> than in this repository. Questions about Zapier itself — building Zaps, task
history, billing — are for [Zapier's help centre](https://help.zapier.com).

## Reporting a bug

Use the **Bug report** template. Most reports turn out to depend on which trigger or action is involved, the
permissions on the API key, or what the Zap's history says, so include those and we can usually reproduce it
the same day.

Never paste an API key into an issue, a log or a screenshot. If one slips through, delete the key in SendBeam
under **Settings → API keys** and create a new one.

If it is exploitable, do not open an issue — see [SECURITY.md](SECURITY.md).

## Working on a change

You need Node.js 22, the version Zapier runs apps on.

```bash
npm install
npm test            # unit tests against a mocked SendBeam API, and the contract test
npm run validate    # Zapier's schema, integration and style checks
```

`npm test` needs no Zapier or SendBeam account. It does need network access: `test/contract.test.js` checks
every request against the published API description at <https://sendbeam.io/openapi.json>. A new trigger,
action or search without a scenario there fails the suite on purpose.

To try a change in real Zaps, register your own private copy with the
[Zapier Platform CLI](https://docs.zapier.com/platform/quickstart/cli-tutorial) (`npx zapier-platform register`,
then `npx zapier-platform push`) and connect it to a SendBeam workspace of your own.

CI runs the tests and Zapier's validation on every push and pull request, and both must pass before anything is
merged.

## House style

- **One runtime dependency:** `zapier-platform-core`, pinned to the same version as the CLI.
- Errors are shown in SendBeam's own words wherever SendBeam gives some, not a generic message.
- Labels, help text and sample data follow Zapier's conventions — `npm run validate` checks most of them.
- Anything that carries user-written email content goes through `jsonBody()` in `src/api.js`, so SendBeam's
  `{{merge_tags}}` survive Zapier's request client.
- A new trigger, action or search is added to the tables in the README, with the permissions it needs.
- Comments explain *why*, not what. Match the surrounding code rather than your own preferences.

## Pull requests

One change per pull request. Fill in the template; the checklist is short.

Keep the history readable: a clear subject line in the imperative, and a body that says what was wrong rather
than what you typed. Maintainers squash on merge, so the pull request title becomes the commit.

## Releases

Maintainers bump the version in `package.json`, add the changes to [CHANGELOG.md](CHANGELOG.md), and upload the
new version to Zapier with the **Push to Zapier** workflow, which runs the same checks first. Existing Zaps are
then moved to the new version. Nothing is uploaded from a developer's machine.

## Licence

By contributing you agree that your work is licensed under the [MIT licence](LICENSE).
