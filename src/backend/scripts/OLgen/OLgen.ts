import '../../loadenv';
import { Control, getControl, normText } from '../script_util';
import { getTextMapItem, loadTextMaps } from '../textmap';
import { LANG_CODES, LangCode } from '../../../shared/types/dialogue-types';
import { isInt } from '../../../shared/util/numberUtil';
import { mwParse } from '../../../shared/mediawiki/mwParse';
import { MwTemplateNode } from '../../../shared/mediawiki/mwTypes';
import { escapeHtml } from '../../../shared/util/stringUtil';
import { pathToFileURL } from 'url';

function ol_gen_internal(textMapId: number, hideTl: boolean = false, addDefaultHidden: boolean = false, hideRm: boolean = false): string {
  let template = `{{Other Languages
|en      = {EN_official_name}
|zhs     = {CHS_official_name}
|zhs_rm  = {}
|zht     = {CHT_official_name}
|zht_rm  = {}
|zh_tl   = {}
|ja      = {JP_official_name}
|ja_rm   = {}
|ja_tl   = {}
|ko      = {KR_official_name}
|ko_rm   = {}
|ko_tl   = {}
|es      = {ES_official_name}
|es_tl   = {}
|fr      = {FR_official_name}
|fr_tl   = {}
|ru      = {RU_official_name}
|ru_tl   = {}
|th      = {TH_official_name}
|th_rm   = {}
|th_tl   = {}
|vi      = {VI_official_name}
|vi_tl   = {}
|de      = {DE_official_name}
|de_tl   = {}
|id      = {ID_official_name}
|id_tl   = {}
|pt      = {PT_official_name}
|pt_tl   = {}
|tr      = {TR_official_name}
|tr_tl   = {}
|it      = {IT_official_name}
|it_tl   = {}
}}`;
  if (hideTl) {
    template = template.split('\n').filter(s => !s.includes('_tl')).join('\n');
  }
  if (hideRm) {
    template = template.split('\n').filter(s => !s.includes('_rm')).join('\n');
  }
  if (addDefaultHidden) {
    template = template.replace('{{Other Languages', '{{Other Languages\n|default_hidden = 1');
  }
  let olMap: {[code: string]: string} = {};
  for (let langCode of LANG_CODES) {
    if (langCode === 'CH') {
      continue;
    }
    let textInLang = getTextMapItem(langCode, textMapId) || '';
    olMap[langCode] = textInLang;

    let langText = normText(textInLang, langCode, true);
    if (langCode === 'CHS' || langCode === 'CHT' || langCode === 'KR' || langCode === 'JP') {
      // replacing this character at the request of kalexhu
      langText = langText.replace(/·/g, '・'); // neither are standard periods so no backlash is needed
    }
    template = template.replace(`{${langCode}_official_name}`, langText);

    let isFullAscii = /^[\u0000-\u007f]*$/.test(textInLang);
    if (langCode === 'TH' && isFullAscii) {
      template = template.replace(/\|th_rm\s*=\s*\{}/, '');
      template = template.replace(/\|th_tl\s*=\s*\{}/, '');
    }
  }
  if (olMap['EN'] === olMap['ES']) {
    template = template.replace(/\|es_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['FR']) {
    template = template.replace(/\|fr_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['RU']) {
    template = template.replace(/\|ru_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['ID']) {
    template = template.replace(/\|id_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['TH']) {
    template = template.replace(/\|th_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['VI']) {
    template = template.replace(/\|vi_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['DE']) {
    template = template.replace(/\|de_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['ID']) {
    template = template.replace(/\|id_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['PT']) {
    template = template.replace(/\|pt_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['TR']) {
    template = template.replace(/\|tr_tl\s*=\s*\{}/, '');
  }
  if (olMap['EN'] === olMap['IT']) {
    template = template.replace(/\|it_tl\s*=\s*\{}/, '');
  }
  return template.replaceAll('{}', '').replaceAll('\\"', '"').replace(/{F#([^}]+)}{M#([^}]+)}/g, '($1/$2)').split('\n').filter(s => !!s).join('\n');
}

export interface OLGenOptions {
  hideTl?: boolean,
  addDefaultHidden?: boolean,
  langCode?: LangCode,
  hideRm?: boolean,
}

export interface OLResult {
  textMapId: number,
  result: string,

  templateNode?: MwTemplateNode;
}

export async function ol_gen(ctrl: Control, name: string, options: OLGenOptions = {}): Promise<OLResult[]> {
  if (isInt(name)) {
    return [await ol_gen_from_id(ctrl, parseInt(name), options)];
  }

  let idList: number[] = await ctrl.findTextMapIdsByExactName(options.langCode || ctrl.inputLangCode, name);
  if (!idList || !idList.length) {
    return [];
  }
  let allResults: OLResult[] = [];
  let seen = new Set<string>();
  for (let textMapId of idList) {
    let result = ol_gen_internal(textMapId, options.hideTl, options.addDefaultHidden, options.hideRm);
    if (result.includes('{EN_official_name}')) {
      continue;
    }
    if (seen.has(result)) {
      continue;
    }
    seen.add(result);
    allResults.push({textMapId, result});
  }
  return Array.from(allResults);
}

export async function ol_gen_from_id(ctrl: Control, textMapId: number, options: OLGenOptions = {}): Promise<OLResult> {
  if (!textMapId) {
    return null;
  }
  let result = ol_gen_internal(textMapId, options.hideTl, options.addDefaultHidden, options.hideRm);
  return {textMapId, result};
}

/**
 * Highlight OL differences on the passed-in parameters in-place.
 *
 * Be aware that the [OLResult.result]{@link OLResult#result} property will be converted to HTML.
 *
 * @param olResults
 * @returns the same olResults array that was passed in
 */
export function highlight_ol_differences(olResults: OLResult[]): OLResult[] {
  for (let olResult of olResults) {
    let mwParseResult = mwParse(olResult.result);
    olResult.templateNode = mwParseResult.parts.find(p => p instanceof MwTemplateNode) as MwTemplateNode;
  }

  for (let olResult of olResults) {
    for (let param of olResult.templateNode.params) {
      let didHighlight = false;
      for (let otherOlResult of olResults) {
        if (otherOlResult == olResult) {
          continue;
        }
        let otherParam = otherOlResult.templateNode.getParam(param.key);
        if (otherParam && param.value !== otherParam.value) {
          if (!param.value.includes(`<span class="highlight">`)) {
            param.setValue('<span class="highlight">' + escapeHtml(param.value) + '</span>');
          }
          didHighlight = true;
        }
      }
      if (!didHighlight) {
        param.setValue(escapeHtml(param.value));
      }
    }
  }

  return olResults;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await loadTextMaps(['EN', 'CHS']);
    console.log(await ol_gen(getControl(), `"Outlander Brigade!"`));

    console.log(await ol_gen(getControl(), `A letter given to you by Sumida.\\nGive this letter to Kama in Ritou.`))
    // console.log(await ol_gen(getControl(), `Master Chef: Vanarana`, {
    //   hideTl: true,
    // }));

//     let out = highlight_ol_differences([{
//       textMapId: 1861052848,
//       result: `{{Other Languages
// |en      = Iris
// |zhs     = 伊丽丝
// |zhs_rm  =
// |zht     = 伊麗絲
// |zht_rm  =
// |zh_tl   =
// |ja      = イリス
// |ja_rm   =
// |ja_tl   =
// |ko      = 이리스
// |ko_rm   =
// |ko_tl   =
// |es      = Iris
// |fr      = Iris
// |ru      = Ирис
// |ru_tl   =
// |th      = Iris
// |vi      = Iris
// |de      = Iris
// |id      = Iris
// |pt      = Iris
// |tr      = Iris
// |it      = Iris
// }}`
//   }, {
//       textMapId: 1892768677,
//       result: `{{Other Languages
// |en      = Iris
// |zhs     = 玉霞
// |zhs_rm  =
// |zht     = 玉霞
// |zht_rm  =
// |zh_tl   =
// |ja      = 玉霞
// |ja_rm   =
// |ja_tl   =
// |ko      = 옥희
// |ko_rm   =
// |ko_tl   =
// |es      = Iris
// |fr      = Iris
// |ru      = Юй Ся
// |ru_tl   =
// |th      = Iris
// |vi      = Iris
// |de      = Iris
// |id      = Iris
// |pt      = Yuxia
// |pt_tl   =
// |tr      = Iris
// |it      = Iris
// }}`
//     }]);
//
//     console.log(out[0].result);
//     console.log(out[1].result);
  })();
}