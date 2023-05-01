import '../loadenv';
import { GenshinControl, getGenshinControl } from '../domain/genshin/genshinControl';
import { loadEnglishTextMap } from '../domain/genshin/textmap';
import { defaultMap, isEmpty } from '../../shared/util/genericUtil';
import { resolveObjectPath, toArray } from '../../shared/util/arrayUtil';
import { closeKnex } from '../util/db';
import { pathToFileURL } from 'url';
import { basename } from 'path';
import { isInt } from '../../shared/util/numberUtil';
import chalk from 'chalk';

type InspectOpt = {file: string, inspectFieldValues?: string[], printRecordIfFieldNotEmpty?: string[]};

async function inspectGenshinDataFile(ctrl: GenshinControl, opt: InspectOpt): Promise<any[]> {
  if (!opt.inspectFieldValues)
    opt.inspectFieldValues = [];
  if (!opt.printRecordIfFieldNotEmpty)
    opt.printRecordIfFieldNotEmpty = [];

  const tableName = basename(opt.file).split('.json')[0];
  const result: any[] = await ctrl.readGenshinDataFile(opt.file);

  let fieldsToValues: {[fieldName: string]: Set<any>} = defaultMap('Set');
  let fieldsWithUniqueValues: Set<string> = new Set();
  let fieldsToType: {[name: string]: { type: string, canBeNil: boolean }} = {};

  for (let record of result) {
    for (let key of opt.printRecordIfFieldNotEmpty) {
      if (!isEmpty(resolveObjectPath(record, key))) {
        console.log(record);
      }
    }
    for (let key of opt.inspectFieldValues) {
      toArray(resolveObjectPath(record, key)).forEach(value => {
        fieldsToValues[key].add(value);
      });
    }
    for (let key of Object.keys(record)) {
      if (fieldsToValues[key].has(record[key])) {
        fieldsWithUniqueValues.delete(key);
      } else {
        fieldsWithUniqueValues.add(key);
      }
      fieldsToValues[key].add(record[key]);
    }
  }

  for (let field of Object.keys(fieldsToValues)) {
    if (field.includes('.') || field.includes('[')) {
      continue;
    }
    let values = fieldsToValues[field];
    if (field === 'Npc') {
      fieldsToType[field] = { type: 'NpcExcelConfigData', canBeNil: true };
    } else if (field === 'Avatar') {
      fieldsToType[field] = { type: 'AvatarExcelConfigData', canBeNil: true };
    } else if (field === 'Monster') {
      fieldsToType[field] = { type: 'MonsterExcelConfigData', canBeNil: true };
    } else {
      fieldsToType[field] = objType(Array.from(values));
    }
  }

  // values -> array of all possible values for a field
  function objType(values: any[], depth: number = 0): { type: string, canBeNil: boolean } {
    if (!values || !values.length) {
      return { type: 'never', canBeNil: false };
    }
    const concat = (a: string[]) => Array.from(new Set<string>(a)).join('|');

    let primitiveTypes = [];
    let arrayTypes = [];
    let combinedObjectKVs: {[field: string]: Set<any>} = defaultMap('Set');
    let canBeNil = false;

    for (let val of values) {
      if (typeof val === 'undefined' || val === null) {
        canBeNil = true;
      } else if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
        primitiveTypes.push(typeof val);
      } else if (Array.isArray(val)) {
        let ret = objType(val, depth + 1);
        if (ret.type !== 'never') {
          arrayTypes.push(ret.type);
        }
      } else if (typeof val === 'object') {
        for (let objKey in val) {
          combinedObjectKVs[objKey].add(val[objKey]);
        }
      }
    }

    let allTypes = [];
    if (primitiveTypes.length) {
      allTypes.push(concat(primitiveTypes));
    }
    if (arrayTypes.length) {
      if (arrayTypes.length === 1) {
        allTypes.push(arrayTypes[0] + '[]');
      } else {
        if ((new Set(arrayTypes)).size <= 1) {
          allTypes.push((arrayTypes[0] || 'never') + '[]');
        } else {
          allTypes.push('(' + concat(arrayTypes) + ')[]');
        }
      }
    }
    if (Object.keys(combinedObjectKVs).length) {
      let s = '{';
      for (let key in combinedObjectKVs) {
        let objValues = Array.from(combinedObjectKVs[key]);
        let ret = objType(objValues, depth + 1);
        s += `, ${key}${ret.canBeNil ? '?' : ''}: ${ret.type}`;
      }
      s += ' }';
      s = s.replace(/\{,/g, `{`);
      allTypes.push(s);
    }

    if ((new Set(allTypes)).size <= 1) {
      return { type: allTypes[0] || 'never', canBeNil };
    } else {
      return { type: '(' + concat(allTypes) + ')', canBeNil };
    }
  }

  console.log('-'.repeat(100))
  for (let field of opt.inspectFieldValues) {
    let values = Array.from(fieldsToValues[field]).sort();
    let isOptionalField = values.some(v => typeof v === 'undefined' || v === null);

    values = values.filter(v => typeof v !== 'undefined' && v !== null)
    values = values.map(x => String(JSON.stringify(x)).replace(/"/g, "'"));

    let singleLineThreshold: boolean = values.join(' | ').length < 110;
    if (!singleLineThreshold) {
      let padEndNum = Math.max(... values.map(v => v.length));
      if (padEndNum % 4 !== 0) {
        padEndNum += 4 - (padEndNum % 4);
      }
      values = values.map(v => v.padEnd(padEndNum));
    }

    let valueStr = values.join(singleLineThreshold ? ' | ' : '|\n  ') + ';';
    if (!singleLineThreshold) {
      valueStr = '  ' + valueStr;
    }
    console.log(`${opt.file} - Unique values for field "${field}":${isOptionalField ? ' (optional field)' : ''}\n` + valueStr);
    console.log();
  }
  console.log(chalk.underline.bold(`Interface:`));
  console.log(`export interface ${tableName} {`);
  for (let field of Object.keys(fieldsToType)) {
    console.log(`  ${field}${fieldsToType[field].canBeNil ? '?' : ''}: ${fieldsToType[field].type},`);
  }
  console.log('}')
  console.log();
  console.log(chalk.underline.bold(`Potential schema:`));
  console.log(`  ${tableName}: <SchemaTable> {`);
  console.log(`    name: '${tableName}',`);
  console.log(`    jsonFile: './ExcelBinOutput/${tableName}.json',`);
  console.log(`    columns: [`);
  let foundPrimary = false;
  for (let field of Object.keys(fieldsToType)) {
    let fieldHasUniqueValues = fieldsWithUniqueValues.has(field);
    let fieldHasMultipleValues = fieldsToValues[field].size > 1;
    let fieldHasPotentialIndexName = (field.endsWith('TextMapHash') || field.endsWith('Id') || field.endsWith('Type') || field.endsWith('Quality') || field.endsWith('Level') || field.endsWith('Order'))
      && !(field.includes('Path') || field.includes('Json') || field.includes('Icon'));
    let fieldHasPotentialPrimaryName = fieldHasPotentialIndexName && !(field.includes('Hash') || field.includes('Type') || field.endsWith('Quality') || field.endsWith('Level') || field.endsWith('Order'));

    let schemaType = fieldsToType[field].type;
    if (schemaType.endsWith('[]')) {
      continue;
    }
    if (schemaType === 'number') {
      if (Array.from(fieldsToValues[field]).some(v => isInt(v) && (v | 0) !== v)) {
        schemaType = 'decimal';
      } else {
        schemaType = 'integer';
      }
    }

    if (fieldHasUniqueValues && fieldHasMultipleValues && fieldHasPotentialPrimaryName && !foundPrimary) {
      foundPrimary = true;
      console.log(`      {name: '${field}', type: '${schemaType}', isPrimary: true},`);
    } else if (fieldHasPotentialIndexName && fieldHasMultipleValues) {
      console.log(`      {name: '${field}', type: '${schemaType}', isIndex: true},`);
    }
  }
  console.log(`    ]`);
  console.log(`  },`);
  console.log();
  console.log(chalk.underline.bold(`End.`));

  return result;
}

const excel = (file: string) => `./ExcelBinOutput/${file}.json`;

const presets = {
  DialogExcelConfigData: <InspectOpt> { file: excel('DialogExcelConfigData'), inspectFieldValues: ['TalkRole.Type'] },
  MaterialExcelConfigData: <InspectOpt> { file: excel('MaterialExcelConfigData'), inspectFieldValues: ['MaterialType', 'ItemType', 'UseTarget', 'ItemUse[#ALL].UseOp'] },
  CityConfigData: <InspectOpt> { file: excel('CityConfigData') },
  DungeonExcelConfigData: <InspectOpt> { file: excel('DungeonExcelConfigData'), inspectFieldValues: ['Type', 'SubType', 'InvolveType', 'SettleUIType', 'SettleShows[#ALL]', 'RecommendElementTypes[#ALL]', 'StateType', 'PlayType'] },
  DungeonPassExcelConfigData: <InspectOpt> { file: excel('DungeonPassExcelConfigData'), inspectFieldValues: ['Conds[#ALL].CondType', 'LogicType'] },
  DungeonLevelEntityConfigData: <InspectOpt> { file: excel('DungeonLevelEntityConfigData') },
  DungeonEntryExcelConfigData: <InspectOpt> { file: excel('DungeonEntryExcelConfigData'), inspectFieldValues: ['Type', 'CondComb', 'SatisfiedCond[#ALL].Type'] },
  DungeonElementChallengeExcelConfigData: <InspectOpt> { file: excel('DungeonElementChallengeExcelConfigData') },
  DungeonChallengeConfigData: <InspectOpt> { file: excel('DungeonChallengeConfigData'), inspectFieldValues: ['ChallengeType', 'InterruptButtonType', 'SubChallengeSortType'] },
  FettersExcelConfigData: <InspectOpt> { file: excel('FettersExcelConfigData'), inspectFieldValues: ['OpenConds[#ALL].CondType', 'FinishConds[#ALL].CondType', 'Type'] },
  FetterStoryExcelConfigData: <InspectOpt> { file: excel('FetterStoryExcelConfigData'), inspectFieldValues: ['OpenConds[#ALL].CondType', 'FinishConds[#ALL].CondType'] },
  FetterInfoExcelConfigData: <InspectOpt> { file: excel('FetterInfoExcelConfigData'), inspectFieldValues: ['AvatarAssocType', 'OpenConds[#ALL].CondType', 'FinishConds[#ALL].CondType'] },
  LocalizationExcelConfigData: <InspectOpt> { file: excel('LocalizationExcelConfigData'), inspectFieldValues: ['AssetType'] },
  TalkExcelConfigData: <InspectOpt> { file: excel('TalkExcelConfigData'), inspectFieldValues: ['BeginCond[#ALL].Type', 'FinishExec[#ALL].Type', 'HeroTalk', 'LoadType', 'TalkMarkType'] },
  QuestExcelConfigData: <InspectOpt> { file: excel('QuestExcelConfigData'), inspectFieldValues: ['AcceptCond[#ALL].Type', 'BeginExec[#ALL].Type', 'FailCond[#ALL].Type', 'FailExec[#ALL].Type', 'FinishCond[#ALL].Type', 'FinishExec[#ALL].Type',] },
  ReliquaryExcelConfigData: <InspectOpt> { file: excel('ReliquaryExcelConfigData'), inspectFieldValues: ['EquipType', 'ItemType', 'DestroyRule'] },
  WeaponExcelConfigData: <InspectOpt> { file: excel('WeaponExcelConfigData'), inspectFieldValues: ['WeaponType', 'DestroyRule', 'ItemType'] },
  AchievementExcelConfigData: <InspectOpt> { file: excel('AchievementExcelConfigData'), inspectFieldValues: ['Ttype', 'IsShow', 'ProgressShowType', 'TriggerConfig.TriggerType'] },
  AchievementGoalExcelConfigData: <InspectOpt> { file: excel('AchievementGoalExcelConfigData') },
  GCGGameRewardExcelConfigData: <InspectOpt> { file: excel('GCGGameRewardExcelConfigData'), inspectFieldValues: ['GroupId'] },
  GCGChallengeExcelConfigData: <InspectOpt> { file: excel('GCGChallengeExcelConfigData'), inspectFieldValues: ['Type', 'ParamList[#ALL]'] },
  WorldAreaConfigData: <InspectOpt> { file: excel('WorldAreaConfigData'), inspectFieldValues: ['ElementType', 'TerrainType', 'AreaType'] },
  NewActivityExcelConfigData: <InspectOpt> { file: excel('NewActivityExcelConfigData') },
  LoadingSituationExcelConfigData: <InspectOpt> { file: excel('LoadingSituationExcelConfigData'), inspectFieldValues: ['LoadingSituationType', 'AreaTerrainType', 'PicPath'] },

  CombineExcelConfigData: <InspectOpt> { file: excel('CombineExcelConfigData'), inspectFieldValues: ['RecipeType'] },
  CompoundExcelConfigData: <InspectOpt> { file: excel('CompoundExcelConfigData'), inspectFieldValues: ['Type'] },
  CookRecipeExcelConfigData: <InspectOpt> { file: excel('CookRecipeExcelConfigData'), inspectFieldValues: ['FoodType', 'CookMethod'] },

};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const ctrl = getGenshinControl();
    await loadEnglishTextMap();

    //await inspectGenshinDataFile(ctrl, presets.CookRecipeExcelConfigData);
    await inspectGenshinDataFile(ctrl, { file: excel('ForgeExcelConfigData') });

    await closeKnex();
  })();
}