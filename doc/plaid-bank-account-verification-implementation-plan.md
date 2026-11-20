# Plaid Bank Account Verification — Implementation Plan

2026-11-19 · Kan Kora

## Fixed contract shape

DocuSign's extension-app manifest fixes the request/response shape for `POST /api/verify/bankAccount` and `POST /api/verify/bankAccountOwner`: the caller sends raw `accountNumber`/`routingNumber` (plus `firstName`/`lastName` for the owner check) and expects `{ verified: boolean }` back in that same request. Plaid's normal flow runs the other way — the user authenticates to their bank through Plaid Link *first*, and only then does Plaid hand back verified account and routing numbers. A real integration therefore needs a Link step that runs **before** the DocuSign call, with its result cached somewhere the verify endpoint can check against — replacing today's hardcoded `SAMPLE_BANK_ACCOUNTS` array.

## Architecture

Link only has to run once per bank account; afterwards the verify endpoints just read the store it filled.

## Implementation steps

1. **Plaid setup** — sandbox `PLAID_CLIENT_ID`/`PLAID_SECRET` already added to `development.env`; wire them into `env.ts`, run `npm install plaid`.
2. **Plaid client util** — `src/utils/plaidClient.ts` wrapping the Plaid Node SDK, pointed at `PLAID_ENV`.
3. **Link endpoints** — new `src/services/plaidLink.service.ts` plus routes: `POST /api/link/token/create` (calls `linkTokenCreate`) and `POST /api/link/token/exchange` (exchanges `public_token`, calls `authGet` and `identityGet`, stores the result in an in-memory `Map` keyed by `accountNumber + routingNumber`, replacing `SAMPLE_BANK_ACCOUNTS`).
4. **Rewire verify services** — `bankAccountVerification.service.ts` and `bankAccountOwnerVerification.service.ts` become `async`, look up the store instead of the hardcoded array, and compare owner names from Plaid Identity for the owner-verification endpoint.
5. **Demo frontend** — static `public/demo.html` using Plaid's Link JS: calls `/link/token/create`, launches Link, exchanges the token, then calls the existing verify endpoints with the numbers Plaid returned.

## How to test for a demo

| Track | What it shows | Steps |
| --- | --- | --- |
| Interactive (browser) | Multiple real institutions (Chase, Bank of America, PNC) picked live | Open `demo.html` → "Connect bank" → search the institution → log in with Plaid's sandbox credentials `user_good` / `pass_good` (MFA `1234` if asked) → pick an account → call `/api/verify/bankAccount` with the returned numbers |
| Scripted (curl/Postman) | Same result, no browser, swappable institution id | `POST /sandbox/public_token/create` (Plaid) with an `institution_id` → feed the `public_token` into `/link/token/exchange` → `POST /api/verify/bankAccount` with a JWT from this repo's existing `/oauth/token` mock auth server → expect `verified: true`; swap the institution id to demo a different bank |

To exercise the failure path, submit mismatched `firstName`/`lastName` to `/api/verify/bankAccountOwner` and expect `verified: false`.

## Status

All steps implemented and tested end-to-end against the live Plaid sandbox (SDK v51, resource-client style: `plaidClient.link.createToken`, `.item.exchangePublicToken`, `.auth.get`, `.identity.get`).

- [x] Plaid sandbox credentials added to `development.env`
- [x] `env.ts` updated with Plaid vars
- [x] Plaid client util (`src/utils/plaidClient.ts`)
- [x] Link token create/exchange endpoints (`src/controllers/plaidLink.controller.ts`, `src/services/plaidLink.service.ts`)
- [x] Verify services rewired to the Plaid-backed store (`src/services/plaidAccountStore.ts`)
- [x] Demo HTML page (`views/demo.html`) + server-side `/api/demo/token` helper so the browser demo never needs the OAuth client secret
- [x] End-to-end test across Chase (`ins_56`) and PNC (`ins_13`) sandbox institutions via `/sandbox/public_token/create` → `/api/link/token/exchange` → `/api/verify/bankAccount` (`verified: true`) and `/api/verify/bankAccountOwner`, both for a matching name (`verified: true`) and a mismatched name (`verified: false`)
