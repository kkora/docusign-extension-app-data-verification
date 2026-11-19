export interface PlaidVerifiedAccount {
  accountId: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  ownerNames: string[];
}

const verifiedAccounts = new Map<string, PlaidVerifiedAccount>();

const storeKey = (accountNumber: string, routingNumber: string) => `${accountNumber}:${routingNumber}`;

export const saveVerifiedAccount = (account: PlaidVerifiedAccount) => {
  verifiedAccounts.set(storeKey(account.accountNumber, account.routingNumber), account);
};

export const findVerifiedAccount = (accountNumber: string, routingNumber: string) =>
  verifiedAccounts.get(storeKey(accountNumber, routingNumber));
