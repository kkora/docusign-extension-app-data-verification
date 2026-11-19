import { Router } from 'express';
import { expressjwt as jwt } from 'express-jwt';

import Paths from '../constants/paths';
import { createLinkToken, exchangePublicToken } from '../services/plaidLink.service';
import { checkSchema } from 'express-validator';
import { exchangePublicTokenBody } from '../validationSchemas/plaid';
import checkValidationErrors from '../middleware/checkValidationErrors';
import env from '../env';

const plaidLinkRouter = Router();

plaidLinkRouter.post(
  Paths.Link.TokenCreate.Post,
  jwt({
    secret: env.JWT_SECRET_KEY,
    algorithms: ['HS256'],
  }),
  createLinkToken,
);

plaidLinkRouter.post(
  Paths.Link.TokenExchange.Post,
  jwt({
    secret: env.JWT_SECRET_KEY,
    algorithms: ['HS256'],
  }),
  checkSchema(exchangePublicTokenBody, ['body']),
  checkValidationErrors,
  exchangePublicToken,
);

export default plaidLinkRouter;
