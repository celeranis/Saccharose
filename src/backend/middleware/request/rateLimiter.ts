import { NextFunction, Request, Response } from '../../util/router';
import rateLimit from 'express-rate-limit';

const rateLimitSkipRegex: RegExp = /\.css|\.js|\.png|\.svg|\.ico|\.jpg|\.woff|\.env/g;

export default rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  keyGenerator: (req: Request, _res: Response) => {
    return req.clientIp // IP address from requestIp.mw(), as opposed to req.ip
  },
  skip: (req: Request, _res: Response) => {
    return rateLimitSkipRegex.test(req.url);
  }
});