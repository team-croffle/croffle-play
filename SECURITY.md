# Security policy

Croffle Play runs code from many game authors next to player accounts, so we take reports
seriously.

## Reporting a vulnerability

**Do not open a public issue.** Report privately through
[GitHub Security Advisories](https://github.com/team-croffle/croffle-play/security/advisories/new),
or email **support@croffledev.kr** with "security" in the subject.

Please include what is affected (portal, API, rooms, SDK, a published package, game isolation),
how to reproduce it, and the impact you expect. We acknowledge reports within 3 business days and
keep you updated until a fix is released. Please give us a reasonable time to fix the issue before
disclosing it.

## Scope

In scope: this repository and its published packages (`@croffledev/play-*`), and the platform at
`www.croffle-play.link` with its API and rooms server (for example, one game being able to read
another game's data or a player's session through the platform).

Out of scope: bugs inside individual games (report them to the game's own repository), reports
that need a compromised device or browser, and missing best-practice headers without a concrete
impact.

## Supported versions

Only the latest platform release and the SDK majors in `current`, `lts`, or `maintenance` status
(see [docs/sdk-lifecycle.md](./docs/sdk-lifecycle.md)) receive security fixes.

The security model and its known limits: [docs/security.md](./docs/security.md).
