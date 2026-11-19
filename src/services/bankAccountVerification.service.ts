import { BankAccountBody, BankAccountResponse } from '../models/dataVerification';
import { findVerifiedAccount } from './plaidAccountStore';
import { IReq, IRes } from '../utils/types';

export const verifyBankAccount = (req: IReq<BankAccountBody>, res: IRes) => {
  const {
    body: {
      accountNumber,
      accountType,
      routingNumber
    },
  } = req;
  try {
    // Check that accountNumber and routingNumber only contain digits
    if (!/^\d+$/.test(accountNumber)) {
      throw new Error('Invalid account number.');
    }
    if (!/^\d+$/.test(routingNumber) || routingNumber.length !== 9) {
      throw new Error('Invalid routing number. It must be 9 digits long.');
    }
    if (!['checking', 'savings'].includes(accountType.toLowerCase())) {
      throw new Error('Invalid account type. Only "checking" and "savings" are accepted.');
    }

    // Looked up from the Plaid-backed store populated by the Link flow (see plaidLink.service.ts)
    const accountFound = findVerifiedAccount(accountNumber, routingNumber);

    if (accountFound && accountFound.accountType.toLowerCase() === accountType.toLowerCase()) {
      const result: BankAccountResponse = { verified: true }
      return res.json(result);
    } else {
      throw new Error('No matching account found. Verification failed.');
    }
  } catch (err) {
    console.error(`Encountered an error verifying bank account: ${err.message}`);
    const result: BankAccountResponse = { verified: false, verifyFailureReason: err.message };
    return res.json(result);
  }
};