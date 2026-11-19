export interface CreateLinkTokenResponse {
  link_token: string;
}

export interface ExchangePublicTokenBody {
  public_token: string;
  institutionName?: string;
}

export interface ExchangedAccount {
  accountId: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  institutionName: string;
  ownerNames: string[];
}

export interface ExchangePublicTokenResponse {
  accounts: ExchangedAccount[];
}
