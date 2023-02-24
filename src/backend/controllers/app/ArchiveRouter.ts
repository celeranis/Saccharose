import { create, Request, Response, Router } from '../../util/router';
import { getControl } from '../../scripts/script_util';
import { BookSuitExcelConfigData, ReadableView } from '../../../shared/types/readable-types';
import { ol_gen_from_id } from '../../scripts/basic/OLgen';
import {
  selectViewpoints, VIEWPOINT_DEFAULT_FILE_FORMAT_IMAGE, VIEWPOINT_DEFAULT_FILE_FORMAT_MAP,
  VIEWPOINT_FILE_FORMAT_PARAMS,

} from '../../scripts/archive/viewpoints';
import {
  selectTutorials,
  TUTORIAL_FILE_FORMAT_PARAMS,
  TUTORIAL_DEFAULT_FILE_FORMAT_IMAGE,

} from '../../scripts/archive/tutorials';
import { TutorialsByType } from '../../../shared/types/tutorial-types';
import { ViewpointsByRegion } from '../../../shared/types/viewpoint-types';
import { selectAchievements } from '../../scripts/archive/achievements';
import { AchievementsByGoals } from '../../../shared/types/achievement-types';
import { sort } from '../../../shared/util/arrayUtil';

export default async function(): Promise<Router> {
  const router: Router = create();

  router.get('/viewpoints', async (req: Request, res: Response) => {
    let viewpointsList: ViewpointsByRegion = await selectViewpoints(getControl(req));
    delete viewpointsList['then'];
    res.render('pages/archive/viewpoints', {
      title: 'Viewpoints',
      bodyClass: ['page--viewpoints'],
      viewpointsList,
      fileFormatParams: VIEWPOINT_FILE_FORMAT_PARAMS.join(','),
      fileFormatDefault_image: VIEWPOINT_DEFAULT_FILE_FORMAT_IMAGE,
      fileFormatDefault_map: VIEWPOINT_DEFAULT_FILE_FORMAT_MAP,
    });
  })

  router.get('/tutorials', async (req: Request, res: Response) => {
    let tutorialsList: TutorialsByType = await selectTutorials(getControl(req));
    delete tutorialsList['then'];
    res.render('pages/archive/tutorials', {
      title: 'Tutorials',
      bodyClass: ['page--tutorials'],
      tutorialsList,
      fileFormatParams: TUTORIAL_FILE_FORMAT_PARAMS.join(','),
      fileFormatDefault_image: TUTORIAL_DEFAULT_FILE_FORMAT_IMAGE,
    });
  });

  router.get('/achievements', async (req: Request, res: Response) => {
    let achievements: AchievementsByGoals = await selectAchievements(getControl(req));
    res.render('pages/archive/achievements', {
      title: 'Achievements',
      bodyClass: ['page--achievements'],
      achievements,
      goals: sort(Object.values(achievements).map(a => a.Goal), 'OrderId')
    });
  });

  router.get('/readables', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const archive = await ctrl.selectReadableArchiveView();

    res.render('pages/archive/readables', {
      title: 'Books & Readables',
      archive: archive,
      bodyClass: ['pages-readables', 'page--readables-list']
    });
  });

  router.get('/readables/search', async (req: Request, res: Response) => {
    res.render('pages/archive/readables-search', {
      title: 'Search Books & Readables',
      bodyClass: ['page--readables-search']
    });
  });

  router.get('/readables/book-collection/:suitId', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const collection: BookSuitExcelConfigData = await ctrl.selectBookCollection(req.params.suitId);

    let infobox = `{{Book Collection Infobox
|image     = Book ${collection.SuitNameText}.png
|rarity    = ${collection.Books.find(b => b?.Material?.RankLevel)?.Material?.RankLevel}
|volumes   = ${collection.Books.length}
|publisher = 
|author    =`;
    for (let i = 0; i < collection.Books.length; i++) {
      infobox += `\n|vol${i + 1}`.padEnd(12, ' ') + '='
    }
    infobox += '\n}}';

    res.render('pages/archive/readable-collection', {
      title: collection.SuitNameText,
      collection: collection,
      infobox,
      ol: await ol_gen_from_id(ctrl, collection.SuitNameTextMapHash),
      bodyClass: ['pages-readables', 'page--readable-collection']
    });
  });

  router.get('/readables/item/:itemId', async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const readable: ReadableView = await ctrl.selectReadableView(req.params.itemId);

    res.render('pages/archive/readable-item', {
      title: readable.TitleText,
      readable: readable,
      ol: await ol_gen_from_id(ctrl, readable.TitleTextMapHash),
      bodyClass: ['pages-readables', 'page--readable-item']
    });
  });

  return router;
}