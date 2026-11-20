# Postman Collection — Setup & Usage

Step-by-step guide to testing this app's DocuSign-auth → Plaid Link → bank verification flow with Postman.

## 1. Prerequisites

- The app running locally (`npm install && npm run dev`, or however you normally start it) on the port in your `development.env` (default `3000`).
- A `development.env` file in the repo root with real values for `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `AUTHORIZATION_CODE`, `PLAID_CLIENT_ID`, `PLAID_SECRET` (copy from `example.development.env` if you haven't already — see repo root).
- A [Plaid sandbox](https://dashboard.plaid.com/) account, since the collection calls Plaid directly to simulate a completed Link session.

## 2. Import the collection and environment

1. Open Postman.
2. **File → Import** → select both files from this folder:
   - `docusign-extension-app-data-verification.postman_collection.json`
   - `docusign-extension-app-data-verification.postman_environment.json`
3. In the top-right environment dropdown, select **DocuSign Extension App Data Verification - Local**.

## 3. Fill in environment variables

Open the environment (top-right dropdown → the eye icon, or **Environments** in the sidebar) and set the **CURRENT VALUE** column for:

| Variable | Where to get it |
| --- | --- |
| `base_url` | Already set to `http://localhost:3000` — change if your app runs elsewhere |
| `oauth_client_id` | `OAUTH_CLIENT_ID` in `development.env` |
| `oauth_client_secret` | `OAUTH_CLIENT_SECRET` in `development.env` |
| `authorization_code` | `AUTHORIZATION_CODE` in `development.env` |
| `plaid_client_id` | `PLAID_CLIENT_ID` in `development.env` |
| `plaid_secret` | `PLAID_SECRET` in `development.env` |

Everything else (`redirect_uri`, `oauth_state`, `institution_id`, `institution_name`, and all the `access_token`/`account_number`/etc. variables) already has a working default or gets filled in automatically as you run requests — leave them as-is.

## 4. Run the flow

The collection has three folders, meant to be run top to bottom. You can run each request individually (click **Send**) or run the whole collection via the **Runner** (⌘/Ctrl+Click the collection name → **Run**).

### Folder 1 — DocuSign Auth

1. **Authorize** — hits the mock `/oauth/authorize` endpoint the way DocuSign would redirect a user to log in. Just confirms a 200; no token comes back from this call.
2. **Get Token (authorization_code)** — exchanges `authorization_code` for a real `access_token`/`refresh_token`, saved automatically into the environment.
3. **Get User Info** — confirms the token from step 2 works.

   *Alternatives, if you just want a quick token without exercising the full DocuSign flow:*
   - **Get Demo Token [alternative]** — one call, no secrets needed.
   - **OAuth Token (client_credentials) [alternative]** — service-to-service grant.

   Any of these four auth requests sets `access_token` — you only need to run one of them before moving on, but running **Get Token (authorization_code)** gives the most realistic end-to-end test.

### Folder 2 — Plaid Link

1. **Create Link Token** — optional; exercises the same endpoint the browser demo calls before launching Plaid Link.
2. **Plaid Sandbox - Create Public Token** — calls Plaid directly (not this app) to simulate a user completing Link for the institution in `institution_id` (defaults to `ins_56` / Chase — try `ins_13` for PNC). This stands in for logging into Plaid Link with the sandbox credentials `user_good` / `pass_good`.
3. **Exchange Public Token** — sends that token to this app's `/api/link/token/exchange`. The response's account/routing numbers and owner name are saved into the environment (`account_number`, `routing_number`, `account_type`, `owner_first_name`, `owner_last_name`) and into the app's in-memory verified-account store.

### Folder 3 — Verify

1. **Verify Bank Account** — calls `/api/verify/bankAccount` with the numbers from step 2.3. Expects `verified: true`.
2. **Verify Bank Account Owner - Matching Name** — same account, with the owner name Plaid returned. Expects `verified: true`.
3. **Verify Bank Account Owner - Mismatched Name** — same account, with a deliberately wrong name (`Wrong` / `Name`). Expects `verified: false` — this is the failure-path check.

## 5. Re-running

- The app's account store is in-memory, so it resets whenever the server restarts — re-run Folder 2 after a restart before re-running Folder 3.
- `access_token` expires after an hour (JWT `expiresIn: 3600`) — re-run any request in Folder 1 to get a fresh one.
- To test a different bank, change `institution_id`/`institution_name` in the environment and re-run Folder 2 onward (e.g. `ins_13` for PNC).

## Reference

See [doc/plaid-bank-account-verification-implementation-plan.md](../doc/plaid-bank-account-verification-implementation-plan.md) for the design behind this flow.
