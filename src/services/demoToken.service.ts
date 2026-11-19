import jwt from 'jsonwebtoken';
import env from '../env';
import { IReq, IRes } from '../utils/types';
const crypto = require('crypto');

// Issues the same shape of token the mock /oauth/token endpoint does, without
// requiring demo.html to hold OAUTH_CLIENT_ID/SECRET client-side.
export const getDemoToken = (req: IReq, res: IRes) => {
  const accessToken = jwt.sign(
    { type: 'access_token', sub: crypto.randomUUID(), email: `${crypto.randomUUID()}@test.com` },
    env.JWT_SECRET_KEY,
    { expiresIn: 3600 },
  );

  return res.json({ access_token: accessToken });
};
