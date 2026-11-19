import { Plaid } from 'plaid';
import plaidClient from '../utils/plaidClient';
import { saveVerifiedAccount } from './plaidAccountStore';
import { CreateLinkTokenResponse, ExchangePublicTokenBody, ExchangePublicTokenResponse, ExchangedAccount } from '../models/plaid';
import { IReq, IRes } from '../utils/types';
const crypto = require('crypto');

export const createLinkToken = async (req: IReq, res: IRes) => {
  const linkTokenResponse = await plaidClient.link.createToken({
    user: { client_user_id: crypto.randomUUID() },
    client_name: 'Data Verification Reference Implementation',
    products: [Plaid.Products.Auth, Plaid.Products.Identity],
    country_codes: [Plaid.CountryCode.Us],
    language: 'en',
  });

  const result: CreateLinkTokenResponse = { link_token: linkTokenResponse.link_token };
  return res.json(result);
};

export const exchangePublicToken = async (req: IReq<ExchangePublicTokenBody>, res: IRes) => {
  const {
    body: { public_token: publicToken, institutionName },
  } = req;

  const exchangeResponse = await plaidClient.item.exchangePublicToken({ public_token: publicToken });
  const accessToken = exchangeResponse.access_token;

  const [authResponse, identityResponse] = await Promise.all([
    plaidClient.auth.get({ access_token: accessToken }),
    plaidClient.identity.get({ access_token: accessToken }),
  ]);

  const accounts: ExchangedAccount[] = authResponse.numbers.ach.map(achNumber => {
    const account = authResponse.accounts.find(acc => acc.account_id === achNumber.account_id);
    const identity = identityResponse.accounts.find(acc => acc.account_id === achNumber.account_id);
    const ownerNames = identity?.owners.flatMap(owner => owner.names) ?? [];

    const verifiedAccount = {
      accountId: achNumber.account_id,
      accountNumber: achNumber.account,
      routingNumber: achNumber.routing,
      accountType: (account?.subtype ?? 'checking') as 'checking' | 'savings',
      ownerNames,
    };

    saveVerifiedAccount(verifiedAccount);

    return { ...verifiedAccount, institutionName: institutionName ?? 'Unknown institution' };
  });

  const result: ExchangePublicTokenResponse = { accounts };
  return res.json(result);
};
