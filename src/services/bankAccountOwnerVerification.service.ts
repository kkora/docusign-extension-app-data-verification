import { BankAccountOwnerBody, BankAccountOwnerResponse } from '../models/dataVerification';
import { findVerifiedAccount } from './plaidAccountStore';
import { IReq, IRes } from '../utils/types';

const ownerNameMatches = (ownerNames: string[], firstName: string, lastName: string) =>
  ownerNames.some(name => {
    const lowerName = name.toLowerCase();
    return lowerName.includes(firstName.toLowerCase()) && lowerName.includes(lastName.toLowerCase());
  });

export const verifyBankAccountOwner = (req: IReq<BankAccountOwnerBody>, res: IRes) => {
  const {
    body: {
      accountNumber,
      accountType,
      routingNumber,
      firstName,
      lastName
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
    if (!firstName || !lastName) {
      throw new Error('First name and last name cannot be empty.');
    }

    // Looked up from the Plaid-backed store populated by the Link flow (see plaidLink.service.ts)
    const accountFound = findVerifiedAccount(accountNumber, routingNumber);

    if (
      accountFound &&
      accountFound.accountType.toLowerCase() === accountType.toLowerCase() &&
      ownerNameMatches(accountFound.ownerNames, firstName, lastName)
    ) {
      const result: BankAccountOwnerResponse = { verified: true }
      return res.json(result);
    } else {
      throw new Error('No matching account found. Verification failed.');
    }
  } catch (err) {
    console.error(`Encountered an error verifying bank account owner: ${err.message}`);
    const result: BankAccountOwnerResponse = { verified: false, verifyFailureReason: err.message };
    return res.json(result);
  }
};