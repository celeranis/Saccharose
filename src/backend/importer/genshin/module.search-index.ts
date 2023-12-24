import fs from 'fs';
import { getGenshinDataFilePath } from '../../loadenv.ts';
import { getGenshinControl } from '../../domain/genshin/genshinControl.ts';
import chalk from 'chalk';
import { ReadableView } from '../../../shared/types/genshin/readable-types.ts';
import { AchievementExcelConfigData } from '../../../shared/types/genshin/achievement-types.ts';
import { selectTutorials } from '../../domain/genshin/archive/tutorials.ts';
import { TutorialsByType } from '../../../shared/types/genshin/tutorial-types.ts';

export async function importSearchIndex() {
  if (!fs.existsSync(getGenshinDataFilePath('./TextMap/Index/'))) {
    fs.mkdirSync(getGenshinDataFilePath('./TextMap/Index/'));
  }

  const ctrl = getGenshinControl();

  const writeOutput = (file: string, data: any) => {
    fs.writeFileSync(getGenshinDataFilePath(`./TextMap/Index/TextIndex_${file}.json`), JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.blue(' (done)'));
  };

  // Readable Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating readable index...'));
    const archive = await ctrl.selectReadableArchiveView();
    const readableList: ReadableView[] = [
      ...archive.Artifacts,
      ...archive.Weapons,
      ...archive.Materials,
      ...Object.values(archive.BookCollections).flatMap(bookSuit => bookSuit.Books),
    ];
    const readableIndex: { [viewId: number]: number } = {};

    for (let view of readableList) {
      readableIndex[view.TitleTextMapHash] = view.Id;
      if (view.Document && view.Document.TitleTextMapHash) {
        readableIndex[view.Document.TitleTextMapHash] = view.Id;
      }
    }
    writeOutput('Readable', readableIndex);
  }
  // Material Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating material index...'));
    const materialList = await ctrl.selectAllMaterialExcelConfigData({ LoadRelations: false, LoadSourceData: false });
    const materialIndex: { [textMapHash: number]: number } = {};

    for (let material of materialList) {
      materialIndex[material.NameTextMapHash] = material.Id;
      materialIndex[material.DescTextMapHash] = material.Id;
    }
    writeOutput('Material', materialIndex);
  }
  // Furniture Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating furniture index...'));
    const furnitureList = await ctrl.selectAllFurniture();
    const furnitureIndex: { [textMapHash: number]: number } = {};

    for (let furniture of furnitureList) {
      furnitureIndex[furniture.NameTextMapHash] = furniture.Id;
      furnitureIndex[furniture.DescTextMapHash] = furniture.Id;
    }
    writeOutput('Furniture', furnitureIndex);
  }
  // Furniture Suite Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating furniture suite index...'));
    const furnitureSuiteList = await ctrl.selectAllFurnitureSuite();
    const furnitureSuiteIndex: { [textMapHash: number]: number } = {};

    for (let furniture of furnitureSuiteList) {
      furnitureSuiteIndex[furniture.SuiteNameTextMapHash] = furniture.SuiteId;
      furnitureSuiteIndex[furniture.SuiteDescTextMapHash] = furniture.SuiteId;
    }
    writeOutput('FurnitureSuite', furnitureSuiteIndex);
  }
  // Weapon Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating weapon index...'));
    const weaponList = await ctrl.selectAllWeapons();
    const weaponIndex: { [textMapHash: number]: number } = {};

    for (let weapon of weaponList) {
      weaponIndex[weapon.NameTextMapHash] = weapon.Id;
      weaponIndex[weapon.DescTextMapHash] = weapon.Id;
    }
    writeOutput('Weapon', weaponIndex);
  }
  // Achievement Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating achievement index...'));
    const achievementList: AchievementExcelConfigData[] = await ctrl.readDataFile('./ExcelBinOutput/AchievementExcelConfigData.json');
    const achievementIndex: { [textMapHash: number]: number } = {};

    for (let achievement of achievementList) {
      if (!achievement.TitleText) {
        continue;
      }
      achievementIndex[achievement.TitleTextMapHash] = achievement.Id;
      achievementIndex[achievement.DescTextMapHash] = achievement.Id;
    }
    writeOutput('Achievement', achievementIndex);
  }
  // Tutorial Index
  // --------------------------------------------------------------------------------------------------------------
  {
    process.stdout.write(chalk.bold('Generating tutorial index...'));
    const tutorialsByType: TutorialsByType = await selectTutorials(ctrl);
    const tutorialIndex: { [id: number]: number } = {};
    for (let tutorials of Object.values(tutorialsByType)) {
      for (let tutorial of tutorials) {
        if (tutorial.PushTip?.TitleTextMapHash) {
          tutorialIndex[tutorial.PushTip.TitleTextMapHash] = tutorial.Id;
        }
        if (tutorial.DetailList) {
          for (let detail of tutorial.DetailList) {
            if (detail) {
              tutorialIndex[detail.DescriptTextMapHash] = tutorial.Id;
            }
          }
        }
      }
    }
    writeOutput('Tutorial', tutorialIndex);
  }
}
