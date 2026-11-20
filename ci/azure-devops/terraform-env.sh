#!/usr/bin/env bash
# Shared setup for the Azure DevOps pipeline's Terraform steps: wires the
# AzureCLI@2 task's federated-identity token into the ARM_* vars the azurerm
# provider needs for OIDC auth, exports the TF_VAR_* inputs, and swaps in a
# CI-only backend (same pattern as .github/workflows/terraform-deploy.yml).
set -euo pipefail

export ARM_CLIENT_ID="$servicePrincipalId"
export ARM_TENANT_ID="$tenantId"
export ARM_SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
export ARM_USE_OIDC=true
export ARM_OIDC_TOKEN="$idToken"

export TF_VAR_application_name="$APPLICATION_NAME"
export TF_VAR_location="$AZURE_LOCATION"
export TF_VAR_execution_mode=ci
export TF_VAR_application_oauth_client_id="$APPLICATION_OAUTH_CLIENT_ID"
export TF_VAR_application_oauth_client_secret="$APPLICATION_OAUTH_CLIENT_SECRET"
export TF_VAR_application_plaid_client_id="$PLAID_CLIENT_ID"
export TF_VAR_application_plaid_secret="$PLAID_SECRET"
export TF_VAR_application_plaid_env="$PLAID_ENV"

mv providers.tf providers.tf.bak
cat > azure_ci.tf <<'EOF'
terraform {
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
}
EOF
