# Spec 001 — Reliable catalog user search for template assignment

## Problem

When assigning an `OnboardingTemplate` to a user, the assign dialog's "Search User"
field could not reliably find all users in the catalog. Two defects:

1. **FTS-gated search (backend).** `GET /users/search` used the catalog
   `fullTextFilter` (the search index) as the primary source, and only fell back
   to scanning real catalog users when FTS returned fewer than 5 rows. If the FTS
   index was unpopulated, stale, or returned 5+ partial matches, genuinely
   matching users were silently missed. Users reported "we were not able to
   search all the [users] here".
2. **No browse (frontend + backend).** An empty query returned `[]`, so a user
   could not open the picker and see the available users without first guessing a
   search term.

## Goals

- Searching must consider **every** `User` entity in the catalog (up to a safety
  cap), independent of the FTS index health.
- An empty query lists users so the picker can be browsed.
- Matching is case-insensitive across name, title, `spec.profile.displayName`,
  and `spec.profile.email`.
- Keep the existing permission check (`onboarding.template.assign`) and the
  100-char query guard.
- Bounded result set and bounded catalog read (no DoS regression).

## Non-goals

- Replacing the catalog as the source of users.
- Server-side pagination of the picker (out of scope; capped result set is fine).

## Behavior

`GET /users/search?query=<q>`

| Input | Result |
| ----- | ------ |
| empty / missing `query` | up to `MAX_USER_SEARCH_RESULTS` users, ordered by displayName |
| non-empty `query` | users whose name/title/displayName/email contain `q` (case-insensitive), capped at `MAX_USER_SEARCH_RESULTS` |
| `query` length > 100 | `400 InputError` |
| caller lacks `onboarding.template.assign` | `403 NotAllowedError` |

Implementation reads `User` entities via `catalogApi.getEntities` (capped at
`MAX_CATALOG_USERS`, with a `fields` projection) and filters in memory. The FTS
`queryEntities` path is removed so results no longer depend on index state.

Frontend assign dialog: trigger a search when the dialog opens (empty query) so
the list is populated before typing, and keep the 300 ms debounce while typing.

## Acceptance

- Backend test: empty query returns users; partial term matches across all four
  fields; results capped; >100 chars rejected; permission DENY → 403.
- `yarn tsc` clean and package tests green for `onboarding-backend` and
  `onboarding`.
