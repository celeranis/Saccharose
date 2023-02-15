import { create, Request, Response, Router } from '../../util/router';
import { getControl } from '../../scripts/script_util';
import { getGCGControl } from '../../scripts/gcg/gcg_control';
import { generateGCGTutorialDialogue } from '../../scripts/gcg/gcg_tutorial_text';

export default async function(): Promise<Router> {
  const router: Router = create();

  router.get('/TCG/talk-detail', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    res.render('pages/gcg/gcg-talk-detail', {
      title: 'TCG Talk Detail',
      talkSections: await getGCGControl(ctrl).generateGCGTalkDialogueSections(),
      bodyClass: ['page--tcg-talk-detail']
    });
  });

  router.get('/TCG/tutorial-text', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    res.render('pages/gcg/gcg-tutorial-text', {
      title: 'TCG Tutorial Text',
      dialogue: await generateGCGTutorialDialogue(ctrl),
      bodyClass: ['page--tcg-tutorial-text']
    });
  });

  // TODO: rules page


  router.get('/TCG/stages/:stageId', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const gcgCtrl = getGCGControl(ctrl);
    const stage = await gcgCtrl.selectStage(req.params.stageId);

    let title = stage.EnemyNameText || String(stage.Id);
    if (stage?.Reward?.LevelNameText) {
      title += '/' + stage.Reward.LevelNameText
    }

    res.render('pages/gcg/gcg-stage', {
      title: title + ' | TCG Stage',
      stage: stage,
      bodyClass: ['page--tcg-stage']
    });
  });

  return router;
}