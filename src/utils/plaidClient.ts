import { PlaidClient, PlaidEnvironment } from 'plaid';
import env from '../env';

const environment = env.PLAID_ENV === 'production' ? PlaidEnvironment.Production : PlaidEnvironment.Sandbox;

export default new PlaidClient({
  clientId: env.PLAID_CLIENT_ID,
  secret: env.PLAID_SECRET,
  environment,
});
