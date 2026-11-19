import { Schema } from 'express-validator';

export const exchangePublicTokenBody: Schema = {
  public_token: { isString: true },
  institutionName: { isString: true, optional: true }
};
