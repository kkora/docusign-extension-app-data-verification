# Deploying to Azure via Azure DevOps — Step-by-Step Guide

This walks through standing up the same infrastructure the repo's GitHub Actions workflow (`.github/workflows/terraform-deploy.yml`) creates — an Azure Container Registry + Linux Web App for Containers, provisioned by `terraform/azure` — but run from an **Azure DevOps Pipeline** instead. Both CI paths now share the same Terraform module and are kept in sync.

## Checklist

- [x] `terraform/azure/variables.tf` + `webapp.tf` pass through `NODE_ENV`, `PORT`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` as container app settings
- [x] `.github/workflows/terraform-deploy.yml` updated to supply the new `TF_VAR_application_plaid_*` values
- [x] `azure-pipelines.yml` created at the repo root, using the same Terraform variables
- [ ] Create the Terraform state resource group, storage account, and blob container in Azure (`rg-tfstate` / `tfstatedocusignverify` / `tfstate`)
- [ ] Create or import this repo into an Azure DevOps project
- [ ] Create an Azure Resource Manager service connection using Workload Identity Federation, scoped to the target subscription/resource group, with Contributor role
- [ ] Create a Variable Group named `docusign-verify-secrets` with `APPLICATION_OAUTH_CLIENT_ID`, `APPLICATION_OAUTH_CLIENT_SECRET`, `PLAID_CLIENT_ID`, `PLAID_SECRET` (secret) and `PLAID_ENV` (plain) — the pipeline already expects this exact group name
- [ ] Also add the equivalent `PLAID_CLIENT_ID`/`PLAID_SECRET` repo Secrets and `PLAID_ENV` repo Variable in GitHub, if you're keeping that workflow active too
- [ ] Create the pipeline in Azure DevOps pointing at `azure-pipelines.yml`
- [ ] Push to the `deploy` branch to trigger the first run
- [ ] Confirm `terraform output` prints `application_service_url`
- [ ] Hit `<application_service_url>/api/demo/token` and confirm it returns a JSON `access_token` (proves the container booted with all required env vars)
- [ ] Note the destroy steps (`terraform plan -destroy` / `terraform apply`) for when you need to tear it down

## What was already fixed in this repo (applies to both GitHub and Azure DevOps)

These were gaps in `terraform/azure` that would've crashed the deployed container regardless of which CI system triggered it — now fixed once, shared by both:

1. **Plaid + `NODE_ENV` + `PORT` weren't passed to the container.** `src/env.ts` requires `NODE_ENV`, `PORT`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (among others) or it throws on boot. `terraform/azure/webapp.tf` only set `JWT_SECRET_KEY`/`OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET`/`AUTHORIZATION_CODE`, and `PORT` was missing entirely (only `WEBSITES_PORT`, which tells Azure which port to route to — it doesn't get injected into the container as `PORT`). Added `application_node_env`, `application_plaid_client_id`, `application_plaid_secret`, `application_plaid_env` variables to `variables.tf`, and wired all of them (plus `PORT`) into `local.application_webapp_system_settings`/`application_webapp_container_settings` in `webapp.tf`.
2. **`manifest.json` claim in an earlier draft of this doc was wrong** — `terraform/azure/variables.tf`'s `manifest_files_paths` already correctly lists the real files under `manifests/authorizationCode/` and `manifests/clientCredentials/`. The auto-generated `terraform/azure/README.md` shows a stale `["../../manifest.json"]` default that doesn't match the actual `.tf` file — that's a doc-generation bug in the repo, not a deployment blocker. No action needed here.
3. **`.github/workflows/terraform-deploy.yml`** now also sets `TF_VAR_application_plaid_client_id`/`TF_VAR_application_plaid_secret`/`TF_VAR_application_plaid_env` from new `PLAID_CLIENT_ID`/`PLAID_SECRET` (secrets) and `PLAID_ENV` (variable) — add those in GitHub if that workflow stays in use alongside Azure DevOps.
4. **New `azure-pipelines.yml`** at the repo root, plus a shared `ci/azure-devops/terraform-env.sh` script, implement the Azure DevOps side using the exact same Terraform variables — see step 6 below for what it does.

## 1. Prerequisites

- An Azure subscription with Owner or Contributor + User Access Administrator rights (needed to create the federated identity).
- An Azure DevOps organization and project ([dev.azure.com](https://dev.azure.com)), with this repo pushed to it (or connected as a GitHub service connection if you want to keep the code on GitHub and only run the pipeline in Azure DevOps).
- Azure CLI installed somewhere you can run a few one-time setup commands — your machine, or [Azure Cloud Shell](https://shell.azure.com) in the browser if you don't want to install anything locally.

## 2. One-time Azure setup: Terraform state storage

Terraform needs a pre-existing place to store its state file — it won't create its own backend. Run once (Cloud Shell or local Azure CLI, already logged in via `az login`):

```sh
az group create --name rg-tfstate --location eastus

az storage account create \
  --name tfstatedocusignverify \
  --resource-group rg-tfstate \
  --sku Standard_LRS \
  --encryption-services blob

az storage container create \
  --name tfstate \
  --account-name tfstatedocusignverify
```

Note the names — you'll reference them as pipeline variables in step 6. Pick a globally-unique storage account name if `tfstatedocusignverify` is taken.

## 3. Create the Azure DevOps project and import the repo

1. In [dev.azure.com](https://dev.azure.com), create (or open) a project.
2. **Project Settings → Repositories → Import repository**, paste this repo's URL, or push the repo directly to an Azure Repos remote if you want it hosted there instead of GitHub.
3. If you'd rather keep the code on GitHub and just run the pipeline from Azure DevOps, you can instead create the pipeline against the GitHub repo directly (Azure Pipelines supports GitHub as a source) — skip the import.

## 4. Create a Service Connection (Workload Identity Federation)

This is Azure DevOps's equivalent of the OIDC login the GitHub workflow does with `azure/login@v1` — no client secret to manage or rotate.

1. **Project Settings → Service connections → New service connection → Azure Resource Manager**.
2. Choose **Workload identity federation (automatic)**. Azure DevOps will create the Azure AD App Registration and its federated credential for you in one step — this is simpler than the manual `az ad app federated-credential create` GitHub requires.
3. Select your subscription, scope it to the resource group you'll deploy into (or subscription-wide), and name the connection — e.g. `azure-devops-docusign-verify`. You'll reference this name in the pipeline YAML.
4. Grant it the **Contributor** role on the subscription/resource group if the wizard doesn't do it automatically.

## 5. Store secrets in a Variable Group

**Pipelines → Library → + Variable group.**

Create one group, e.g. `docusign-verify-secrets`, and add:

| Variable | Secret? | Value |
| --- | --- | --- |
| `APPLICATION_OAUTH_CLIENT_ID` | lock icon on | any value — Terraform treats it as an input, not a real DocuSign credential |
| `APPLICATION_OAUTH_CLIENT_SECRET` | lock icon on | same |
| `PLAID_CLIENT_ID` | lock icon on | from your `development.env` / Plaid dashboard |
| `PLAID_SECRET` | lock icon on | from your `development.env` / Plaid dashboard |
| `PLAID_ENV` | plain | `sandbox` (or `production`) |

## 6. The pipeline YAML (already in the repo)

`azure-pipelines.yml` at the repo root and `ci/azure-devops/terraform-env.sh` are already created — nothing to author here, just review them before your first run:

- **Two separate `AzureCLI@2` steps** — a `Terraform plan` step that runs on pull requests into `deploy`, and a `Terraform apply` step that only runs on a push to `deploy`. This mirrors the GitHub workflow's `if: github.event_name == 'pull_request'` / `'push'` split.
- **Each step explicitly maps the variable-group secrets via `env:`.** Unlike GitHub Actions (where job-level `env:` is visible to every step automatically), Azure DevOps does **not** expose secret variables as environment variables unless a step's `env:` block maps them by name — so each `AzureCLI@2` step maps `APPLICATION_OAUTH_CLIENT_SECRET`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, etc. explicitly.
- **`ci/azure-devops/terraform-env.sh`** is sourced at the top of each step's inline script. It exports `ARM_CLIENT_ID`/`ARM_TENANT_ID`/`ARM_SUBSCRIPTION_ID`/`ARM_OIDC_TOKEN` from the `addSpnToEnvironment: true` values (`$servicePrincipalId`, `$tenantId`, `$idToken`), exports all the `TF_VAR_*` values, and swaps in the CI-only `azurerm` backend — the same pattern `.github/workflows/terraform-deploy.yml` uses, just factored into a shared script instead of being duplicated across both pipeline steps.
- No separate `docker login`/ACR step is needed: `terraform/azure/image.tf` already runs `az acr login` and `docker push` itself via `local-exec` provisioners once the registry exists, as long as `az` and `docker` are available on the agent (both are preinstalled on Microsoft-hosted `ubuntu-latest` agents).
- `TerraformInstaller@1` is a built-in Azure Pipelines task — no separate marketplace extension required.

The `azureSubscription` input in both steps is set to `azure-devops-docusign-verify` — rename it in `azure-pipelines.yml` to match whatever you actually name the service connection in step 4, and update the `docusign-verify-secrets` variable-group name/`tfState*` values if you used different names in steps 2/5.

## 7. Create the pipeline

1. **Pipelines → New pipeline** → point it at your repo → **Existing Azure Pipelines YAML file** → select `azure-pipelines.yml`.
2. Save (don't run yet if you want to double check branch protections first).
3. Push to a `deploy` branch — the pipeline only triggers on that branch, matching the existing GitHub workflow's trigger.

## 8. Run it and verify

1. The pipeline run should show Terraform creating a resource group, container registry, service plan, and Linux Web App, then building/pushing the Docker image and deploying it.
2. At the end of the `terraform apply` step, check the logged `terraform output` for `application_service_url` — that's your deployed app's URL.
3. Hit `https://<that-url>/api/demo/token` to confirm the server actually started (should return a JSON `access_token`), which also confirms the Plaid/`NODE_ENV`/`PORT` app settings from the "What was already fixed" section made it through correctly.

## 9. Tearing it down

From the same `terraform/azure` directory, with the same `ARM_*`/`TF_VAR_*` env vars and backend config set, run:

```sh
terraform plan -destroy -out app.destroy.tfplan
terraform apply app.destroy.tfplan
```

You can run this manually via Azure CLI/Cloud Shell, or add a second pipeline (or a manually-triggered stage) that runs the same steps with `-destroy`.

## Reference

- [terraform/README.md](../terraform/README.md) — the general Terraform deployment guide this is adapted from
- [terraform/azure/README.md](../terraform/azure/README.md) — Azure-specific Terraform module docs (inputs/outputs)
- [.github/workflows/terraform-deploy.yml](../.github/workflows/terraform-deploy.yml) — the GitHub Actions equivalent of this pipeline
