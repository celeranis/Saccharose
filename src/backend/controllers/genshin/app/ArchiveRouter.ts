import { create, Request, Response, Router } from '../../../util/router';
import { getGenshinControl } from '../../../domain/genshin/genshinControl';
import { BookSuitExcelConfigData, ReadableView } from '../../../../shared/types/genshin/readable-types';
import { ol_gen_from_id, OLResult } from '../../../domain/generic/basic/OLgen';
import {
  getCityIdsWithViewpoints,
  selectViewpoints, VIEWPOINT_DEFAULT_FILE_FORMAT_IMAGE, VIEWPOINT_DEFAULT_FILE_FORMAT_MAP,
  VIEWPOINT_FILE_FORMAT_PARAMS,

} from '../../../domain/genshin/archive/viewpoints';
import {
  selectTutorials,
  TUTORIAL_FILE_FORMAT_PARAMS,
  TUTORIAL_DEFAULT_FILE_FORMAT_IMAGE, pushTipCodexTypeName,

} from '../../../domain/genshin/archive/tutorials';
import { PushTipsCodexType, PushTipsCodexTypeList, TutorialsByType } from '../../../../shared/types/genshin/tutorial-types';
import { ViewpointsByRegion } from '../../../../shared/types/genshin/viewpoint-types';
import {
  AchievementExcelConfigData,
  AchievementGoalExcelConfigData,
  AchievementsByGoals,
} from '../../../../shared/types/genshin/achievement-types';
import { paramCmp } from '../../../util/viewUtilities';
import { generateLoadingTipsWikiText, selectLoadingTips } from '../../../domain/genshin/archive/loadingTips';
import { LoadingTipsByCategory } from '../../../../shared/types/genshin/loading-types';
import { toInt } from '../../../../shared/util/numberUtil';
import { SbOut } from '../../../../shared/util/stringUtil';

export default async function(): Promise<Router> {
  const router: Router = create();

  // Material Items
  // ~~~~~~~~~~~~~~
  router.get('/items', async (req: Request, res: Response) => {
    res.render('pages/genshin/archive/material-search', {
      title: 'Items',
      bodyClass: ['page--items'],
    });
  });

  router.get('/items/:itemId', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);

    if (req.params.itemId) {
      const material = await ctrl.selectMaterialExcelConfigData(req.params.itemId, {
        LoadRelations: true,
        LoadSourceData: true,
        LoadItemUse: true,
      });

      res.render('pages/genshin/archive/material-item', {
        title: material ? material.NameText : 'Item not found',
        bodyClass: ['page--items'],
        material,
        ol: material ? (await ol_gen_from_id(ctrl, material.NameTextMapHash)) : null
      });
    } else {
      res.render('pages/genshin/archive/material-item', {
        title: 'Item not found',
        bodyClass: ['page--materials'],
      });
    }
  });

  // Weapons
  // ~~~~~~~
  router.get('/weapons', async (req: Request, res: Response) => {
    res.render('pages/genshin/archive/weapon-search', {
      title: 'Weapons',
      bodyClass: ['page--weapons'],
    });
  });

  router.get('/weapons/:weaponId', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);

    if (req.params.weaponId) {
      const weapon = await ctrl.selectWeaponById(req.params.weaponId, {LoadRelations: true, LoadReadable: true});

      res.render('pages/genshin/archive/weapon-item', {
        title: weapon ? weapon.NameText : 'Item not found',
        bodyClass: ['page--weapons'],
        weapon,
        ol: weapon ? (await ol_gen_from_id(ctrl, weapon.NameTextMapHash)) : null
      });
    } else {
      res.render('pages/genshin/archive/weapon-item', {
        title: 'Weapon not found',
        bodyClass: ['page--weapons'],
      });
    }
  })

  // Viewpoints
  // ~~~~~~~~~~

  router.get('/viewpoints/:city?', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    let cityName: string = '';
    let viewpointsList: ViewpointsByRegion = null;

    if (req.params.city) {
      let cityId = await ctrl.getCityIdFromName(req.params.city);
      if (cityId) {
        cityName = await ctrl.selectCityNameById(cityId);
        viewpointsList = await selectViewpoints(ctrl, cityId);
      }
    }

    const cityIdsWithViewpoints = await getCityIdsWithViewpoints(ctrl);
    const cities = await ctrl.selectAllCities(city => cityIdsWithViewpoints.has(city.CityId));

    res.render('pages/genshin/archive/viewpoints', {
      title: `${cityName} Viewpoints`.trim(),
      bodyClass: ['page--viewpoints'],
      cities,
      viewpointsList,
      fileFormatParams: VIEWPOINT_FILE_FORMAT_PARAMS.join(','),
      fileFormatDefault_image: VIEWPOINT_DEFAULT_FILE_FORMAT_IMAGE,
      fileFormatDefault_map: VIEWPOINT_DEFAULT_FILE_FORMAT_MAP,
    });
  })

  // Tutorials
  // ~~~~~~~~~

  router.get('/tutorials/:category?', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const codexTypes: PushTipsCodexType[] = PushTipsCodexTypeList;
    let codexTypeName: string = null;
    let tutorialsList: TutorialsByType = null;

    if (req.params.category) {
      let codexType = codexTypes.find(codexType => paramCmp(pushTipCodexTypeName(codexType), req.params.category));
      if (codexType) {
        codexTypeName = pushTipCodexTypeName(codexType);
        tutorialsList = await selectTutorials(ctrl, codexType);
      }
    }

    res.render('pages/genshin/archive/tutorials', {
      title: codexTypeName ? `Tutorials - ${codexTypeName}` : 'Tutorials',
      bodyClass: ['page--tutorials'],
      categoryNames: codexTypes.map(pushTipCodexTypeName),
      tutorialsList,
      fileFormatParams: TUTORIAL_FILE_FORMAT_PARAMS.join(','),
      fileFormatDefault_image: TUTORIAL_DEFAULT_FILE_FORMAT_IMAGE,
    });
  });

  // Achievements
  // ~~~~~~~~~~~~

  router.get('/achievements/search', async (req: Request, res: Response) => {
    res.render('pages/genshin/archive/achievements-search', {
      title: 'Achievements',
      bodyClass: ['page--achievements', 'page--achievements-search'],
    });
  });

  router.get('/achievements/:category?', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const goals = await ctrl.selectAchievementGoals();
    let goalName: string = '';
    let achievements: AchievementsByGoals = null;

    if (req.params.category) {
      let goal = goals.find(goal =>
        paramCmp(goal.NameTextEN, req.params.category) ||
        paramCmp(goal.NameText, req.params.category) ||
        paramCmp(goal.Id, req.params.category)
      );
      if (goal) {
        goalName = goal.NameText;
        achievements = await ctrl.selectAchievements(goal.Id);
      }
    }

    res.render('pages/genshin/archive/achievements', {
      title: goalName ? `Achievements - ${goalName}` : 'Achievements',
      bodyClass: ['page--achievements', 'page--achievements-categories'],
      goals,
      achievements
    });
  });

  router.get('/achievements/:category/:id', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const achievement = await ctrl.selectAchievement(toInt(req.params.id));

    const sb = new SbOut();
    if (achievement) {
      const achievements = Object.values(await ctrl.selectAchievements(achievement.GoalId))[0].Achievements;
      const achievementsWithSameName = achievements
        .filter(a => a.TitleText === achievement.TitleText); // should include self

      sb.line('{{Achievement Infobox');
      sb.setPropPad(13);
      sb.prop('title', achievement.TitleText);
      sb.prop('id', achievement.Id);
      sb.prop('order id', achievement.OrderId);
      sb.prop('category', achievement.Goal.NameText);
      sb.prop('description', achievement.DescText);
      sb.prop('requirements');
      sb.prop('primogems', achievement.FinishReward.RewardSummary.PrimogemCount);
      sb.prop('tracking');
      sb.prop('topic');
      if (achievement.Goal.Id === 0) {
        sb.prop('type');
      }
      sb.prop('quest');
      sb.prop('hidden');
      if (achievementsWithSameName.length > 1) {
        sb.prop('set', achievement.TitleText);
        sb.prop('tier', achievementsWithSameName.findIndex(a => a.Id === achievement.Id) + 1);
        sb.prop('tiers_total', achievementsWithSameName.length);
      }
      sb.line('}}');
      sb.line(`'''${achievement.TitleText}''' is an [[Achievement]] in the category ''[[${achievement.Goal.NameText}]]''. To complete this achievement, the player must <!-- achieve steps -->.`);
      sb.line();
      sb.line('==Other Languages==');
      sb.line((await ol_gen_from_id(ctrl, achievement.TitleTextMapHash)).result);
      sb.line();
      sb.line('==Change History==');
      sb.line('{{Change History|<!-- version -->}}');
      sb.line();
      sb.line('==Navigation==');
      sb.line('{{Achievement Navbox}}');
      sb.line();
    }

    res.render('pages/genshin/archive/achievement-page', {
      title: 'Achievement: ' + (achievement?.TitleText || 'Not Found'),
      bodyClass: ['page--achievements', 'page--achievements-single'],
      achievement,
      wikitext: sb.toString(),
      id: req.params.id,
    });
  });


  // Readables
  // ~~~~~~~~~

  router.get('/readables', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const archive = await ctrl.selectReadableArchiveView();

    res.render('pages/genshin/archive/readables', {
      title: 'Books & Readables',
      archive: archive,
      bodyClass: ['page--readables', 'page--readables-list']
    });
  });

  router.get('/readables/search', async (req: Request, res: Response) => {
    res.render('pages/genshin/archive/readables-search', {
      title: 'Search Books & Readables',
      bodyClass: ['page--readables-search']
    });
  });

  router.get('/readables/book-collection/:suitId', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
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

    res.render('pages/genshin/archive/readable-collection', {
      title: collection.SuitNameText,
      collection: collection,
      infobox,
      ol: await ol_gen_from_id(ctrl, collection.SuitNameTextMapHash),
      bodyClass: ['page--readables', 'page--readable-collection']
    });
  });

  router.get('/readables/item/:itemId', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const readable: ReadableView = await ctrl.selectReadableView(req.params.itemId);

    res.render('pages/genshin/archive/readable-item', {
      title: readable.TitleText,
      readable: readable,
      ol: await ol_gen_from_id(ctrl, readable.TitleTextMapHash),
      bodyClass: ['page--readables', 'page--readable-item']
    });
  });

  // Loading Tips
  // ~~~~~~~~~~~~

  router.get('/loading-tips', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const limitTips: number[] = typeof req.query.ids === 'string' ? req.query.ids.split(',')
      .map(x => x.trim()).filter(x => !!x).map(x => toInt(x)) : null;
    const loadingTipsByCategory: LoadingTipsByCategory = await selectLoadingTips(ctrl);
    const wikitextByCategory: { [cat: string]: string } = generateLoadingTipsWikiText(ctrl, loadingTipsByCategory, limitTips);

    res.render('pages/genshin/archive/loading-tips', {
      title: 'Loading Tips',
      wikitextByCategory,
      bodyClass: ['page--loading-tips']
    });
  });

  // Furniture
  // ~~~~~~~~~

  router.get('/furnishings', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);

    const furnitureList = await ctrl.selectAllFurniture();

    const typeTree = await ctrl.selectFurnitureTypeTree();

    res.render('pages/genshin/archive/furniture-list', {
      title: 'Furnishings',
      furnitureList,
      typeTree,
      bodyClass: ['page--furniture']
    });
  });

  router.get('/furnishings/:furnId', async (req: Request, res: Response) => {
    const ctrl = getGenshinControl(req);
    const furn = await ctrl.selectFurniture(req.params.furnId);
    const sb: SbOut = new SbOut();
    const ol: OLResult = furn ? (await ol_gen_from_id(ctrl, furn.NameTextMapHash)) : null;

    if (furn) {
      sb.setPropPad(15);
      sb.line('{{Furnishing Infobox');
      sb.prop('id', furn.Id);
      sb.prop('image', `Item ${furn.NameText}.png`, true);
      sb.prop('category', furn.CategoryNameText);
      sb.prop('subcategory', furn.TypeNameText);
      sb.prop('quality', furn.RankLevel);
      sb.prop('adeptal_energy', furn.Comfort);
      sb.prop('load', furn.Cost);
      sb.prop('reduced_load', furn.DiscountCost);
      sb.prop('description', ctrl.normText(furn.DescText, ctrl.outputLangCode));
      sb.prop('blueprint', '');
      sb.line('}}');
      sb.line(`'''${furn.NameText}''' is a${furn.MakeData ? ' creatable' : ''} [[Furnishing]] item that can be used in the [[Serenitea Pot]].`);
      sb.line();
      if (furn.MakeData) {
        sb.line('==Creation==');
        sb.line(`First time creation grants {{Item|Trust|24|x=${furn.MakeData.Exp}}}.`);
        sb.setPropPad(1);
        sb.line('{{Recipe');
        sb.prop('type', 'Creation');
        sb.prop('time', String(furn.MakeData.MakeTime).slice(0,2)+'h');
        for (let vec of furn.MakeData.MaterialItems) {
          sb.prop(vec.Material.NameText, vec.Count);
        }
        sb.prop('sort', furn.MakeData.MaterialItems.map(vec => vec.Material.NameText).join(';'));
        sb.line('}}');
        sb.line();
      }
      sb.line('==Furnishing Sets==');
      sb.line('{{Craft Usage}}');
      sb.line();
      sb.line('==Other Languages==');
      sb.line(ol?.result);
      sb.line();
      sb.line('==Change History==');
      sb.line('{{Change History|<!-- version -->}}');
      sb.line();
      sb.line('==Navigation==');
      if (
        furn.TypeId === 7011 ||  // Curio
        furn.TypeId === 14002 || // Dreambloom
        furn.TypeId === 14003 || // Snowman Component
        furn.TypeId === 14004 || // Floral Scene
        furn.TypeId === 14005 || // Main Flower
        furn.TypeId === 14006 || // Carving Component
        furn.TypeId === 14007    // Shop Components
      ) {
        sb.line('{{Furnishing Navbox/Subsystems|Curio}}');
      } else if (
        furn.TypeId === 3007 || // Fish Tank
        furn.TypeId === 14001 // Ornamental Fish
      ) {
        sb.line('{{Furnishing Navbox/Subsystems|Fish Pond}}');
      } else if (
        furn.TypeId === 9001 || // Indoor Creature
        furn.TypeId === 9002    // Outdoor Creature
      ) {
        sb.line('{{Furnishing Navbox/Living|Animal}}');
      } else if (furn.CategoryId === 10) {
        sb.line('{{Furnishing Navbox/Living|Companion}}');
      } else {
        sb.line(`{{Furnishing Navbox|${furn.IsInterior ? 'interior' : 'exterior'}}}`);
      }
      sb.line();
    }

    res.render('pages/genshin/archive/furniture-page', {
      title: 'Furnishings',
      furn,
      wikitext: sb.toString(),
      bodyClass: ['page--furniture'],
      ol,
    });
  });

  return router;
}