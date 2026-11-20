# Creating a Data Verification Template and Integrating This Extension App

2026-11-19 · Kan Kora

This repo already implements the proxy side (seven verification use cases, Plaid-backed bank
account checks per [plaid-bank-account-verification-implementation-plan.md](plaid-bank-account-verification-implementation-plan.md),
and an Azure deployment pipeline per [azure-devops-deployment-guide.md](azure-devops-deployment-guide.md)).
What's still missing is the DocuSign-side wiring: registering this app as an **Extension App**,
and building a **template** whose Data Verification field actually calls it. This guide covers
that gap end to end.

It's organized around the three DocuSign support articles that were reviewed for this plan
(these are Salesforce Lightning pages that render client-side, so treat the summaries below —
cross-checked against `developers.docusign.com`'s extension-app reference docs — as the source of
truth, not a literal transcript):

- "Welcome to Docusign Data Verification" — what Data Verification is and where it shows up in the UI.
- "Select Data Verification Fields for Envelopes and Templates" — adding the field to a template/envelope.
- "Docusign Data Verification Extensions" — how an installed extension app backs that field.

## How the pieces fit together

```
DocuSign Template (Add Fields page)
  └─ Data Verification field ("Verify Bank Account")
       └─ backed by an installed Extension App
            └─ Extension App manifest (manifests/authorizationCode/bankAccountVerification.manifest.json)
                 ├─ connections: OAuth2 to <PROXY_BASE_URL>/api/oauth/{authorize,token}
                 └─ actions:     Verify.Version3.BankAccount → POST <PROXY_BASE_URL>/api/verify/bankAccount
                                                                      └─ this repo → Plaid
```

The field only shows up in the template editor **after** the extension app is registered,
tested, and installed for the account — so do the developer-side steps first.

## Part A — Deploy the proxy and get a public base URL

The extension app's manifest needs a stable `<PROXY_BASE_URL>` that DocuSign can reach over the
internet; DocuSign will call it on every verification attempt, so localhost/ngrok only works for
manual testing, not a real template.

1. Follow [azure-devops-deployment-guide.md](azure-devops-deployment-guide.md) (or the GitHub
   Actions equivalent) to deploy. Push to `deploy` and let Terraform provision the Container
   Registry + Linux Web App.
2. After `terraform apply`, run `terraform output application_service_url` — that's your base URL.
3. Run `terraform output output_manifest_files_paths` — Terraform already templated
   `<PROXY_BASE_URL>`, `<CLIENT_ID>`, and `<CLIENT_SECRET>` into real manifest files at those
   paths (see `terraform/common/modules/template/main.tf`), so you don't need to hand-edit the
   placeholders yourself. Use the `authorizationCode/bankAccountVerification.manifest.json`
   variant unless you have a specific reason to use client-credentials (private, machine-to-machine
   only) instead.
4. Sanity-check the deploy: `GET <application_service_url>/api/demo/token` should return a JSON
   `access_token`.

If you'd rather test locally first: run `npm run dev`, tunnel it with `ngrok http <PORT>`, and
manually substitute `<PROXY_BASE_URL>` in a copy of the manifest with the ngrok forwarding URL, per
the main [README.md](../README.md#create-an-extension-app). Swap to the Terraform-deployed URL
before anything you intend to keep working long-term — ngrok URLs rotate.

## Part B — Register the extension app in DocuSign

1. Go to the [Developer Console](https://devconsole.docusign.com/) and log in with a DocuSign
   developer account.
2. Create a new app, or open an existing one, then go to its **Extension apps** section.
3. Choose **Upload a manifest file** and upload the manifest from step A.3
   (`bankAccountVerification.manifest.json`). This is faster and less error-prone than the
   form-based flow since every field the form asks for is already in the file.
4. Confirm the uploaded manifest shows:
   - `connections[0].params.customConfig.tokenUrl` / `authorizationUrl` → your real base URL + `/api/oauth/token` / `/api/oauth/authorize`
   - `actions[0].params.uri` → your real base URL + `/api/verify/bankAccount`
   - `extensions[0].template` → `Verify.Version3.BankAccount`
5. Keep `distribution: "PUBLIC"` only if you actually intend to publish to the App Center later;
   for development, `PRIVATE` is simpler and skips App Center review.

## Part C — Test the extension app

DocuSign's Developer Console runs three checks before it'll let you attach the extension to a
template — use [Test your extension](https://developers.docusign.com/extension-apps/build-an-extension-app/test/)
from the console, in this order:

1. **Connection test** — DocuSign calls your `authorizationUrl`/`tokenUrl`. This repo's mock
   OAuth server (`src/controllers/auth.controller.ts`) issues a JWT if `clientId`/`clientSecret`
   in the manifest match `OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` in your deployed env. If this
   fails, check the Azure Web App's app settings match what's in the manifest.
2. **Extension test** — DocuSign sends a sample request to `/api/verify/bankAccount` and checks
   the response shape (`{ verified, responseCode, providerResponseCode }`). Use the sample
   request body from [README.md](../README.md#test-the-extension-app):
   ```json
   { "accountNumber": "123456789", "accountType": "checking", "routingNumber": "987654321" }
   ```
   Since the verify service is now Plaid-backed rather than the old mock array (per
   [plaid-bank-account-verification-implementation-plan.md](plaid-bank-account-verification-implementation-plan.md)),
   this will only return `verified: true` for numbers that actually came out of a completed Plaid
   Link flow (see Part E's note on running Link before verification) — use
   `views/demo.html`/`/api/link/token/exchange` first to populate the store, or expect
   `verified: false` for arbitrary numbers, which is still a passing extension test.
3. **Functional test** — only available once the extension is attached to a template (Part E);
   it drives an actual envelope through to confirm an end-signer's input triggers the call.

Fix anything that fails here before moving on — a template can't successfully use a field whose
extension fails its own tests.

## Part D — Install the extension app for your account

Per "Docusign Data Verification Extensions": an extension app must be **installed** by an account
admin before its fields are selectable anywhere else in the product, even if you're the one who
registered it.

1. In the same DocuSign account (or an account you administer), go to
   **Admin → Apps and Keys** (or **Admin → Extension Apps**, naming varies by account type).
2. Find the app you registered in Part B and install it for the account. For a private app this
   is a direct install; for a public one you'd normally install it from the App Center instead.
3. Confirm the signed-in user has the permission to use Data Verification fields — some account
   plans gate this behind a feature flag/permission profile.

## Part E — Build the template with a Data Verification field

Per "Welcome to Docusign Data Verification" and "Select Data Verification Fields for Envelopes and
Templates":

1. In eSignature, go to **Templates → New → Create Template** (or edit an existing one).
2. Upload the document(s) and add a recipient role as usual.
3. On the **Add Fields** page, open the fields palette:
   - Basic Data Verification fields appear under **Standard Fields**.
   - Premium/custom ones — which is where your installed extension app's bank-account field
     shows up — appear under **Custom Fields**.
4. Drag the **Bank Account Verification** field (named per your manifest's
   `extensions[0].name`, "My Bank Account Verification Extension" unless you changed it) onto the
   document, over wherever the signer will enter account/routing number and account type.
5. Save the template.

Note on the Plaid flow specifically: this extension contract expects the signer to submit a raw
`accountNumber`/`routingNumber`/`accountType` and get `verified` back in one call — it has no
concept of Plaid Link running first. For a real signer experience you'd need a pre-step (e.g. the
pattern in `views/demo.html`) where the signer connects their bank via Plaid Link *before*
reaching the DocuSign field, so the numbers they type (or that get pre-filled) already exist in
`src/services/plaidAccountStore.ts` and resolve to `verified: true`. Without that pre-step, typed
numbers that were never run through Plaid Link will correctly come back `verified: false`.

## Part F — Send and verify end to end

1. Send an envelope from the template to a test recipient (yourself, or a sandbox signer).
2. As the signer, fill in the bank account fields and attempt to proceed — this is the moment
   DocuSign calls your deployed `/api/verify/bankAccount`.
3. Confirm the signing experience reflects `verified: true`/`false` appropriately, and cross-check
   against your app's logs (Azure Web App → Log stream, or `az webapp log tail`) to see the
   incoming request and Plaid lookup.
4. If it doesn't fire at all, re-run the Part C extension test — a template can silently sit on a
   broken connection if the extension was attached before you fixed the connection test.

## Troubleshooting checklist

| Symptom | Likely cause |
| --- | --- |
| Field doesn't appear in Add Fields palette | App not installed for the account (Part D), or registered under a different DocuSign account than the one you're building the template in |
| Connection test fails | `clientId`/`clientSecret` in manifest don't match `OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` env vars on the deployed app |
| Extension test returns 401/403 | JWT issued by `/api/oauth/token` not being forwarded, or `JWT_SECRET_KEY` mismatch between what signed it and what the verify endpoint expects |
| Extension test always returns `verified: false` | Expected unless the test account number/routing number was first run through `/api/link/token/exchange` — see Part C.2 |
| Works in Developer Console test but not in a real envelope | Template was attached before the connection/extension issue was fixed — detach and reattach the field, or re-run Part C |

## References

- [Welcome to Docusign Data Verification](https://support.docusign.com/s/document-item?language=en_US&bundleId=qki1698158012210&topicId=gxs1698158285710.html&_LANG=enus)
- [Select Data Verification Fields for Envelopes and Templates](https://support.docusign.com/s/document-item?language=en_US&bundleId=qki1698158012210&topicId=yvx1699550441650.html&_LANG=enus)
- [Docusign Data Verification Extensions](https://support.docusign.com/s/document-item?language=en_US&bundleId=qki1698158012210&topicId=cfj1715705896400.html&_LANG=enus)
- [What's inside an extension app registration](https://developers.docusign.com/extension-apps/extension-apps-101/inside-an-extension-app)
- [Extension app manifest reference](https://developers.docusign.com/extension-apps/extension-apps-101/concepts/extension-app-manifest/)
- [Bank account verification extension contract](https://developers.docusign.com/extension-apps/extension-app-reference/extension-contracts/bank-account-verification/)
- [Create an extension app](https://developers.docusign.com/extension-apps/build-an-extension-app/create/)
- [Test your extension](https://developers.docusign.com/extension-apps/build-an-extension-app/test/)
