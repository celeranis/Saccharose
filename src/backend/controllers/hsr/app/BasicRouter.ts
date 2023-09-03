import { create } from '../../../routing/router';
import { getStarRailControl } from '../../../domain/hsr/starRailControl';
import { sendExcelViewerTableResponse } from '../../generic/app/abstractBasicRouter';
import { SbOut } from '../../../../shared/util/stringUtil';
import { Request, Response, Router } from 'express';

export default async function(): Promise<Router> {
  const router: Router = create();

  router.get('/', async (req: Request, res: Response) => {
    res.render('pages/hsr/landing');
  });

  router.get('/textmap', async (req: Request, res: Response) => {
    res.render('pages/generic/basic/textmap', {
      title: 'TextMap Search',
      bodyClass: ['page--textmap']
    });
  });

  router.get('/OL', async (req: Request, res: Response) => {
    res.render('pages/generic/basic/olgen', {
      title: 'OL',
      bodyClass: ['page--OL']
    });
  });

  router.get('/id-usages', async (req: Request, res: Response) => {
    res.render('pages/generic/basic/id-usages', {
      title: 'Identifier usages',
      bodyClass: ['page--id-usages']
    });
  });

  router.get('/excel-viewer', async (req: Request, res: Response) => {
    res.render('pages/generic/basic/excel-viewer-list', {
      title: 'Excel Viewer',
      bodyClass: ['page--excel-viewer'],
      excels: await getStarRailControl(req).getExcelFileNames(),
    })
  });

  router.get('/excel-viewer/:file', async (req: Request, res: Response) => {
    await sendExcelViewerTableResponse(getStarRailControl(req), req, res);
  });

  // Loading Tips
  // ~~~~~~~~~~~~

  router.get('/loading-tips', async (req: Request, res: Response) => {
    const ctrl = getStarRailControl(req);
    let sb: SbOut = new SbOut();

    let loadingTips: {[category: string]: string[]} = await ctrl.getLoadingTips();
    for (let [category, tips] of Object.entries(loadingTips)) {
      sb.line(`===${category}===`);
      for (let tip of tips) {
        sb.line(` * ${tip}`);
      }
      sb.line();
    }

    res.render('pages/hsr/archive/loading-tips', {
      title: 'Loading Tips',
      wikitext: sb.toString(),
      bodyClass: ['page--loading-tips']
    });
  });

  return router;
}