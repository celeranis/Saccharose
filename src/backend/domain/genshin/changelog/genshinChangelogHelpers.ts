import { AvatarExcelConfigData } from '../../../../shared/types/genshin/avatar-types.ts';
import { WeaponExcelConfigData } from '../../../../shared/types/genshin/weapon-types.ts';
import { MaterialExcelConfigData } from '../../../../shared/types/genshin/material-types.ts';
import { HomeWorldFurnitureExcelConfigData, FurnitureSuiteExcelConfigData } from '../../../../shared/types/genshin/homeworld-types.ts';
import {
  GCGCardExcelConfigData, GCGCharExcelConfigData,
  GCGGameExcelConfigData,
} from '../../../../shared/types/genshin/gcg-types.ts';
import { ReadableArchiveView } from '../../../../shared/types/genshin/readable-types.ts';
import {
  ChapterCollection,
  ChapterExcelConfigData,
  MainQuestExcelConfigData,
} from '../../../../shared/types/genshin/quest-types.ts';
import { ChangeRecord, FullChangelog } from '../../../../shared/types/changelog-types.ts';
import { toInt } from '../../../../shared/util/numberUtil.ts';
import { GenshinSchemaNames } from '../../../importer/genshin/genshin.schema.ts';
import { GenshinControl } from '../genshinControl.ts';
import { MonsterExcelConfigData } from '../../../../shared/types/genshin/monster-types.ts';
import { GCGControl, getGCGControl } from '../gcg/gcg_control.ts';
import { AchievementExcelConfigData } from '../../../../shared/types/genshin/achievement-types.ts';
import { LoadingCat, LoadingTipsExcelConfigData } from '../../../../shared/types/genshin/loading-types.ts';
import { TutorialExcelConfigData } from '../../../../shared/types/genshin/tutorial-types.ts';
import { ViewCodexExcelConfigData } from '../../../../shared/types/genshin/viewpoint-types.ts';
import { selectViewpointsByIds } from '../archive/viewpoints.ts';
import { selectLoadingTips } from '../archive/loadingTips.ts';
import { selectTutorials } from '../archive/tutorials.ts';
import { cached } from '../../../util/cache.ts';

export type GenshinChangelogNewRecordSummary = {
  avatars: AvatarExcelConfigData[],
  weapons: WeaponExcelConfigData[],
  foods: MaterialExcelConfigData[],
  tcgItems: MaterialExcelConfigData[],
  blueprints: MaterialExcelConfigData[],
  avatarItems: MaterialExcelConfigData[],
  items: MaterialExcelConfigData[],

  furnishings: HomeWorldFurnitureExcelConfigData[],
  furnishingSets: FurnitureSuiteExcelConfigData[],
  monsters: MonsterExcelConfigData[],
  wildlife: MonsterExcelConfigData[],

  tcgCharacterCards: GCGCharExcelConfigData[],
  tcgActionCards: GCGCardExcelConfigData[],
  tcgStages: GCGGameExcelConfigData[],

  readables: ReadableArchiveView,

  chapters: ChapterCollection,
  nonChapterQuests: MainQuestExcelConfigData[],
  hiddenQuests: MainQuestExcelConfigData[],

  achievements: AchievementExcelConfigData[],
  loadingTips: LoadingTipsExcelConfigData[],
  tutorials: TutorialExcelConfigData[],
  viewpoints: ViewCodexExcelConfigData[],
}

export async function generateGenshinChangelogNewRecordSummary(ctrl: GenshinControl, fullChangelog: FullChangelog): Promise<GenshinChangelogNewRecordSummary> {
  // return cached('GenshinFullChangelogSummary_' + ctrl.outputLangCode + '_' + fullChangelog.version.number, async () => {
    return _generateGenshinChangelogNewRecordSummary(ctrl, fullChangelog);
  // });
}

async function getGcg(ctrl: GenshinControl): Promise<GCGControl> {
  const gcg: GCGControl = getGCGControl(ctrl);
  gcg.disableSkillSelect = true;
  gcg.disableNpcLoad = true;
  gcg.disableRelatedCharacterLoad = true;
  gcg.disableVoiceItemsLoad = true;
  await gcg.init();
  return gcg;
}

export async function _generateGenshinChangelogNewRecordSummary(ctrl: GenshinControl, fullChangelog: FullChangelog): Promise<GenshinChangelogNewRecordSummary> {
  function newRecordsOf(excelFileName: GenshinSchemaNames): ChangeRecord[] {
    if (fullChangelog.excelChangelog?.[excelFileName]?.changedRecords) {
      return Object.values(fullChangelog.excelChangelog[excelFileName].changedRecords).filter(r => r.changeType === 'added');
    } else {
      return [];
    }
  }

  function newIntKeysOf(excelFileName: GenshinSchemaNames): number[] {
    return newRecordsOf(excelFileName).map(r => toInt(r.key));
  }

  async function getLoadingTips() {
    const loadingTips: LoadingTipsExcelConfigData[] = [];
    const loadingCat: LoadingCat = await selectLoadingTips(ctrl);
    const loadingTipIds: number[] = newIntKeysOf('LoadingTipsExcelConfigData');
    let loadingCatQueue = [loadingCat];
    while (loadingCatQueue.length) {
      let currCat = loadingCatQueue.shift();
      for (let tip of currCat.tips) {
        if (loadingTipIds.includes(tip.Id)) {
          loadingTips.push(tip);
        }
      }
      loadingCatQueue.push(... currCat.subCats);
    }
    return loadingTips;
  }

  const out: GenshinChangelogNewRecordSummary = {
    avatars: null,
    weapons: null,
    foods: null,
    tcgItems: null,
    avatarItems: null,
    blueprints: null,
    items: null,

    furnishings: null,
    furnishingSets: null,

    monsters: null,
    wildlife: null,

    tcgCharacterCards: null,
    tcgActionCards: null,
    tcgStages: null,

    viewpoints: null,
    loadingTips: null,
    achievements: null,
    tutorials: null,

    readables: null,

    chapters: null,
    nonChapterQuests: null,
    hiddenQuests: null,
  };

  const gcg: GCGControl = await getGcg(ctrl);

  await Promise.all([
    newIntKeysOf('MaterialExcelConfigData').asyncMap(id => ctrl.selectMaterialExcelConfigData(id)).then(materials => {
      Object.assign(out, {
        foods: materials.filter(item => !!item.FoodQuality || item.MaterialType === 'MATERIAL_FOOD' || item.MaterialType === 'MATERIAL_NOTICE_ADD_HP'),
        tcgItems: materials.filter(item => item.MaterialType && item.MaterialType.startsWith('MATERIAL_GCG')),
        avatarItems: materials.filter(item => item.MaterialType === 'MATERIAL_NAMECARD'
          || item.MaterialType === 'MATERIAL_TALENT' || item.MaterialType === 'MATERIAL_AVATAR'),
        blueprints: materials.filter(item => item.MaterialType === 'MATERIAL_FURNITURE_FORMULA' || item.MaterialType === 'MATERIAL_FURNITURE_SUITE_FORMULA'),
        items: materials.filter(item => (
          !(!!item.FoodQuality || item.MaterialType === 'MATERIAL_FOOD' || item.MaterialType === 'MATERIAL_NOTICE_ADD_HP')
          && !(item.MaterialType && item.MaterialType.startsWith('MATERIAL_GCG'))
          && !(item.MaterialType === 'MATERIAL_FURNITURE_FORMULA' || item.MaterialType === 'MATERIAL_FURNITURE_SUITE_FORMULA')
          && !(item.MaterialType === 'MATERIAL_NAMECARD' || item.MaterialType === 'MATERIAL_TALENT' || item.MaterialType === 'MATERIAL_AVATAR')
        )),
      });
    }),

    newIntKeysOf('MonsterExcelConfigData').asyncMap(monsterId => ctrl.selectMonsterById(monsterId)).then(monsters => {
      out.monsters = monsters.filter(m => !m.AnimalDescribe);
      out.wildlife = monsters.filter(m => !!m.AnimalDescribe);
    }),

    getLoadingTips().then(loadingTips => out.loadingTips = loadingTips),

    newIntKeysOf('ChapterExcelConfigData').asyncMap(id => ctrl.selectChapterById(id, true)).then(async chapters => {
      const chapterCollection: ChapterCollection = ctrl.generateChapterCollection(chapters);
      const chapterQuestIds: Set<number> = new Set(chapters.map(c => c.Quests.map(q => q.Id)).flat());
      const nonChapterQuestIds: number[] = newIntKeysOf('MainQuestExcelConfigData').filter(mqId => !chapterQuestIds.has(mqId));
      const quests: MainQuestExcelConfigData[] = await nonChapterQuestIds.asyncMap(mqId => ctrl.selectMainQuestById(mqId));

      out.chapters = chapterCollection;
      out.nonChapterQuests = quests.filter(mq => !!mq.TitleText);
      out.hiddenQuests = quests.filter(mq => !mq.TitleText);
    }),

    newIntKeysOf('GCGCharExcelConfigData').asyncMap(id => gcg.selectCharacterCard(id)).then(ret => out.tcgCharacterCards = ret),
    newIntKeysOf('GCGCardExcelConfigData').asyncMap(id => gcg.selectActionCard(id)).then(ret => out.tcgActionCards = ret),
    newIntKeysOf('GCGGameExcelConfigData').asyncMap(id => gcg.selectStage(id, {
      disableDeckLoad: true,
      disableTalkLoad: true,
    })).then(ret => out.tcgStages = ret),

    newIntKeysOf('DocumentExcelConfigData').asyncMap(id => ctrl.selectReadableView(id, false)).then(readables => {
      out.readables = ctrl.generateReadableArchiveView(readables);
    }),

    newIntKeysOf('AvatarExcelConfigData').asyncMap(avatarId => ctrl.selectAvatarById(avatarId)).then(avatars => out.avatars = avatars),
    newIntKeysOf('WeaponExcelConfigData').asyncMap(weaponId => ctrl.selectWeaponById(weaponId)).then(weapons => out.weapons = weapons),

    newIntKeysOf('HomeWorldFurnitureExcelConfigData').asyncMap(id => ctrl.selectFurniture(id, {LoadHomeWorldNPC: true})).then(ret => out.furnishings = ret),
    newIntKeysOf('FurnitureSuiteExcelConfigData').asyncMap(id => ctrl.selectFurnitureSuite(id)).then(ret => out.furnishingSets = ret),

    selectViewpointsByIds(ctrl, newIntKeysOf('ViewCodexExcelConfigData')).then(viewpoints => out.viewpoints = viewpoints),
    newIntKeysOf('AchievementExcelConfigData').asyncMap(id => ctrl.selectAchievement(id)).then(achievements => out.achievements = achievements),
    selectTutorials(ctrl, null, newIntKeysOf('TutorialExcelConfigData')).then(tutorialsByType => out.tutorials = Object.values(tutorialsByType).flat()),
  ]);

  return out;
}
