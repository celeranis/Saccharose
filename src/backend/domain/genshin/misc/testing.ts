import '../../../loadenv.ts';
import { GenshinControl, getGenshinControl, loadGenshinVoiceItems } from '../genshinControl.ts';
import { pathToFileURL } from 'url';
import util from 'util';
import { closeKnex } from '../../../util/db.ts';
import { cleanEmpty, resolveObjectPath, sort } from '../../../../shared/util/arrayUtil.ts';
import { DialogueSectionResult, talkConfigGenerate } from '../dialogue/dialogue_util.ts';
import { TalkExcelConfigData } from '../../../../shared/types/genshin/dialogue-types.ts';
import { mwParse } from '../../../../shared/mediawiki/mwParse.ts';
import { MwParentNode, MwTemplateNode } from '../../../../shared/mediawiki/mwTypes.ts';
import { isInt, isNumeric, toNumber } from '../../../../shared/util/numberUtil.ts';
import { toBoolean } from '../../../../shared/util/genericUtil.ts';
import JSON5 from 'json5';
import { evaluateCustomFormat } from '../../../util/fileFormatOptions.ts';
import { AchievementExcelConfigData, AchievementGoalExcelConfigData } from '../../../../shared/types/genshin/achievement-types.ts';
import { getLineNumberForLineText } from '../../../util/shellutil.ts';
import { getGenshinDataFilePath } from '../../../loadenv.ts';
import { uuidv4 } from '../../../../shared/util/uuidv4.ts';
import { loadGenshinTextSupportingData } from '../genshinText.ts';
import { getQuotePosMap } from '../../../../shared/mediawiki/mwQuotes.ts';
import { keys } from 'ag-grid-community/dist/lib/utils/map';
import fs from 'fs';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await loadGenshinVoiceItems();
  await loadGenshinTextSupportingData();

  const ctrl = getGenshinControl();

  // getQuotePos(`<br /><br />'''Escudo de Jade'''<br />Da '''2 pontos de '''Escudo''' blah blah blah foobar ''' asdf`, 10);
  // console.log();
  //
  // getQuotePos(`<br /><br />'''Escudo de Jade'''<br />Da '''2 pontos de '''Escudo''' blah blah blah foobar ''`, 10);
  // console.log();
  //
  // getQuotePos(`<br /><br />'''Escudo de Jade'''<br />Da '''2 pontos de '''Escudo''' blah blah blah foobar '`, 10);
  // console.log();

  // let map = getQuotePosMap(
  //   `'''bold''`
  //   //`<br /><br />'''Escudo de Jade'''<br />Da '''2 pontos de '''Escudo''' blah blah blah foobar '`
  //   //`'''Estela de Pedra'''<br />'''Fase Final: '''Causa 1 ''ponto'' de {{Geo|Dano Geo}}.<br />'''Usos: 2'''1`
  //   //`'''Estela de Pedra'''<br />'''Fase Final: '''Causa 1 ponto de {{Geo|Dano Geo}}.<br />'''Usos: 2'''<br /><br />'''Escudo de Jade'''<br />Da '''2 pontos de '''Escudo'''''' asdf`
  // );
  // console.inspect(map);
  // for (let [key, value] of Object.entries(map)) {
  //   console.log(parseInt(key) + 1 + ':', value);
  // }

  const optionIcons: Set<string> = new Set();
  const actionBefores: Set<string> = new Set();
  const actionWhiles: Set<string> = new Set();
  const actionAfters: Set<string> = new Set();
  const data: any[] = await ctrl.readJsonFile('./ExcelBinOutput/DialogExcelConfigData.json');

  for (let row of data) {
    if (row.optionIcon) {
      optionIcons.add(row.optionIcon);
    }
    if (row.actionBefore) {
      actionBefores.add(row.actionBefore);
    }
    if (row.actionWhile) {
      actionWhiles.add(row.actionWhile);
    }
    if (row.actionAfter) {
      actionAfters.add(row.actionAfter);
    }
  }
  console.log('\nOPTION ICONS:')
  console.log(Array.from(optionIcons).sort());

  console.log('\nACTION BEFORES:')
  console.log(Array.from(actionBefores).sort());

  console.log('\nACTION WHILES:')
  console.log(Array.from(actionWhiles).sort());

  console.log('\nACTION AFTERS:')
  console.log(Array.from(actionAfters).sort());


  // let files: string[] = fs.readdirSync("C:/Shared/git/localweb/Saccharose/public/images/DIcons");
  // for (let f of files) {
  //   console.log(f);
  //   if (f.endsWith('.png')) {
  //     f = f.slice(0, -4);
  //   }
  //   if (!optionIcons.has(f)) {
  //     fs.unlinkSync("C:/Shared/git/localweb/Saccharose/public/images/DIcons/" + f + ".png");
  //   }
  // }

  await closeKnex();
}