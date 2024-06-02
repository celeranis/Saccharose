import { create } from '../../../routing/router.ts';
import {
  handleIdUsagesEndpoint,
  handleOlEndpoint,
  handleTextMapSearchEndpoint,
} from '../../generic/api/abstractBasicResources.ts';
import { getStarRailControl } from '../../../domain/hsr/starRailControl.ts';
import { Request, Response, Router } from 'express';

const router: Router = create();

router.endpoint('/search-textmap', {
  get: async (req: Request, res: Response) => {
    return await handleTextMapSearchEndpoint(getStarRailControl(req), req, res)
  }
});

router.endpoint('/OL/generate', {
  get: async (req: Request, res: Response) => {
    return await handleOlEndpoint(getStarRailControl(req), req, res);
  }
});

router.endpoint('/id-usages', {
  get: async (req: Request, res: Response) => {
    return await handleIdUsagesEndpoint(getStarRailControl(req), req, res);
  }
});

export default router;
