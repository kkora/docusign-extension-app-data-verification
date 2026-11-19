import { Router } from 'express';

import Paths from '../constants/paths';
import { getDemoToken } from '../services/demoToken.service';

const demoTokenRouter = Router();

demoTokenRouter.get(Paths.Demo.Token.Get, getDemoToken);

export default demoTokenRouter;
