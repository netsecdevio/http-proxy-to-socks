## What this changes

<!-- One or two sentences. Link the issue it closes, if any. -->

## Why

<!-- The problem this solves. Behaviour change is the part that needs justification. -->

## How it was verified

<!-- Paste the commands you ran and their result. "Tests pass" alone is not evidence. -->

```sh
npm test
npm run lint
```

## Checklist

- [ ] `npm test` passes locally
- [ ] `npm run lint` passes locally
- [ ] Behaviour changes have a `CHANGELOG.md` entry under an unreleased heading
- [ ] No credentials, tokens, or private hostnames in code, tests, or fixtures
- [ ] New behaviour has a test that fails without this change
- [ ] Public surface (flags, config keys, exports) stays as small as the problem allows
