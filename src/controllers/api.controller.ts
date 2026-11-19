import { Router } from 'express';
import Paths from '../constants/paths';
import dataVerificationRouter from './dataVerification.controller';
import authRouter from './auth.controller';
import plaidLinkRouter from './plaidLink.controller';
import demoTokenRouter from './demoToken.controller';

const apiRouter = Router();

apiRouter.use(Paths.Verify.Base, dataVerificationRouter);

apiRouter.use(Paths.Link.Base, plaidLinkRouter);

apiRouter.use(Paths.Auth.Base, authRouter);

apiRouter.use(Paths.Demo.Base, demoTokenRouter);

export default apiRouter;
