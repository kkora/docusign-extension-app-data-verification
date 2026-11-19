/**
 * Environments variables declared here.
 */

/* eslint-disable node/no-process-env */

const { NODE_ENV, PORT, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, AUTHORIZATION_CODE, JWT_SECRET_KEY, PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;

if (!NODE_ENV) {
  throw new Error('NODE_ENV not set');
}

if (!PORT) {
  throw new Error('PORT not set');
}

if (!OAUTH_CLIENT_ID) {
  throw new Error('OAUTH_CLIENT_ID not set');
}

if (!OAUTH_CLIENT_SECRET) {
  throw new Error('OAUTH_CLIENT_SECRET not set');
}

if (!AUTHORIZATION_CODE) {
  throw new Error('AUTHORIZATION_CODE not set');
}

if (!JWT_SECRET_KEY) {
  throw new Error('JWT_SECRET_KEY not set');
}

if (!PLAID_CLIENT_ID) {
  throw new Error('PLAID_CLIENT_ID not set');
}

if (!PLAID_SECRET) {
  throw new Error('PLAID_SECRET not set');
}

if (!PLAID_ENV) {
  throw new Error('PLAID_ENV not set');
}

export default {
  NODE_ENV,
  PORT,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  AUTHORIZATION_CODE,
  JWT_SECRET_KEY,
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_ENV,
};
