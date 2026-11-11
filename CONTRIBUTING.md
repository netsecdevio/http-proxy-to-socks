# Contributing

hpts is small on purpose. Patches that keep it small are welcome; patches that
grow the surface need to say why in the PR body.

## Development

```sh
git clone https://github.com/netsecdevio/http-proxy-to-socks.git
cd http-proxy-to-socks
npm ci
npm test          # node --test, includes a live SOCKS5 end-to-end test
npm run lint      # ESLint flat config
```

Node.js 18 or newer is required; CI runs the suite on 20, 22 and 24.

## What a change needs

- A test that fails without the change. The suite already drives a real RFC 1928
  SOCKS5 server, so protocol work has a home.
- `npm test` and `npm run lint` green locally.
- A `CHANGELOG.md` entry under an unreleased heading for anything a user can
  observe: flags, defaults, log lines, status codes, exported functions.
- No new runtime dependency unless the problem cannot be solved without one.
  The package ships three (`commander`, `socks`, `socks-proxy-agent`) and that
  is the budget.

## Commits and pull requests

Conventional-commit subjects (`fix:`, `feat:`, `deps:`, `docs:`, `ci:`). One
concern per PR. `master` is protected: pull requests only, required checks, no
force pushes. Dependabot PRs follow the same path.

## Branch rules

`master` is governed by a repository ruleset (`protect-master`) plus the org
baseline ruleset:

- pull requests only; no direct pushes except an administrator bypass
- required checks: `lint`, `test (20)`, `test (22)`, `test (24)`, `audit`,
  `package`, all of which must be green on the branch head
- linear history, no force pushes, no deletion
- merge methods: squash or rebase, never a merge commit
- every commit must carry a verified signature (organisation policy). Configure
  `git config commit.gpgsign true` and `gpg.format ssh` with a signing key that
  is registered to your GitHub account, or GitHub will refuse the merge.

Release tags matching `v*` are protected against deletion and moving.

## Security issues

Never open a public issue. Use the private advisory link in
[SECURITY.md](SECURITY.md); the same form is linked from the issue chooser.

## Releasing

The maintainer stages releases and approves them in the npm console (npm's staged
publishing defers the 2FA proof-of-presence to that approval step):

```sh
npm version patch --no-git-tag-version   # or minor / major
# ...CHANGELOG entry, commit, push, let CI go green
npm stage publish
npm stage list                           # note the stage id
# approve it at npmjs.com, then verify:
npm view @dyneconllc/hpts version
```

Publishing from a laptop uses a granular npm token scoped to `@dyneconllc` with
read and write; it lives in the maintainer's password manager, never in the repo
and never in CI.
