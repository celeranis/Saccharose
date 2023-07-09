import { toInt } from '../../../shared/util/numberUtil';
import { LangCode } from '../../../shared/types/lang-types';
import { SPRITE_TAGS } from './misc/spriteTags';
import { wordRejoin, wordSplit } from '../../../shared/util/stringUtil';
import { genericNormText, mergeMcTemplate, TextNormalizer } from '../generic/genericNormalizers';

function convertGenshinRubi(langCode: LangCode, text: string): string {
  const rubiMap: { [index: number]: string } = {};
  const rubiRegex = /{RUBY#\[([SD])]([^}]+)}/;

  while (rubiRegex.test(text)) {
    const exec = rubiRegex.exec(text);
    const rubiType: string = exec[1]; // either 'S' or 'D'
    const rubiText: string = exec[2];
    let rubiIndex: number = exec.index;

    if (rubiType === 'S') {
      rubiIndex--;
    }

    rubiMap[rubiIndex] = rubiText;

    text = text.replace(rubiRegex, '');
  }

  let parts: Intl.SegmentData[] = wordSplit(langCode, text);

  for (let i = 0; i < parts.length; i++) {
    const part: Intl.SegmentData = parts[i];
    const rubiIndices: number[] = [];

    for (let rubiIndex of Object.keys(rubiMap).map(toInt)) {
      if (part.index <= rubiIndex && rubiIndex < (part.index + part.segment.length)) {
        rubiIndices.push(rubiIndex);
      }
    }

    if (rubiIndices.length) {
      let rubiText = rubiIndices.map(rubiIndex => rubiMap[rubiIndex]).join('');
      part.segment = `{{Rubi|${part.segment}|${rubiText}}}`;
    }
  }
  return wordRejoin(parts);
}

function travelerPlaceholder(langCode: LangCode = 'EN', degender: boolean = false): string {
  switch (langCode) {
    case 'CH':
      return '(旅行者)';
    case 'CHS':
      return '(旅行者)';
    case 'CHT':
      return '(旅行者)';
    case 'DE':
      return degender ? '(Reisender)' : '(Reisender/Reisende)';
    case 'EN':
      return '(Traveler)';
    case 'ES':
      return degender ? '(Viajero)' : '(Viajero/Viajera)';
    case 'FR':
      return degender ? '(Voyageur)' : '(Voyageur/Voyageuse)';
    case 'ID':
      return '(Pengembara)';
    case 'IT':
      return degender ? '(Viaggiatore)' : '(Viaggiatore/Viaggiatrice)';
    case 'JP':
      return '(旅人)';
    case 'KR':
      return '(여행자)';
    case 'PT':
      return '(Viajante)';
    case 'RU':
      return degender ? '(Путешественник)' : '(Путешественник/Путешественница)';
    case 'TH':
      return '(นักเดินทาง)';
    case 'TR':
      return '(Gezgin)';
    case 'VI':
      return '(Nhà Lữ Hành)';
  }
  return '(Traveler)';
}

export const normGenshinText: TextNormalizer = function (text: string,
                                                langCode: LangCode,
                                                decolor: boolean = false,
                                                plaintext: boolean = false,
                                                plaintextMcMode: 'both' | 'male' | 'female' = 'both',
                                                sNum?: number): string {
  if (!text) {
    return text;
  }

  text = genericNormText(text, langCode, decolor, plaintext, plaintextMcMode, travelerPlaceholder);

  if (!decolor && !plaintext) {
    text = text.replace(/<color=#\{0}>(.*?)<\/color>/g, `'''$1'''`);
    text = text.replace(/<color=#00E1FFFF>(.*?)<\/color>/g, '{{color|buzzword|$1}}');
    text = text.replace(/<color=#FFCC33FF>(.*?)<\/color>/g, '{{color|help|$1}}');

    text = text.replace(/<color=#FFACFFFF>(.*?)<\/color>/g, '{{Electro|$1}}');
    text = text.replace(/<color=#99FFFFFF>(.*?)<\/color>/g, '{{Cryo|$1}}');
    text = text.replace(/<color=#80C0FFFF>(.*?)<\/color>/g, '{{Hydro|$1}}');
    text = text.replace(/<color=#FF9999FF>(.*?)<\/color>/g, '{{Pyro|$1}}');
    text = text.replace(/<color=#99FF88FF>(.*?)<\/color>/g, '{{Dendro|$1}}');
    text = text.replace(/<color=#80FFD7FF>(.*?)<\/color>/g, '{{Anemo|$1}}');
    text = text.replace(/<color=#FFE699FF>(.*?)<\/color>/g, '{{Geo|$1}}');

    text = text.replace(/<color=#FFE14BFF>(.*?)<\/color>/g, '{{color|help|$1}}');

    text = text.replace(/<color=#FFFFFFFF>(.*?)<\/color>/g, '\'\'\'$1\'\'\'');
    text = text.replace(/<color=#37FFFF>(.*?) ?<\/color>/g, '\'\'\'$1\'\'\'');
    text = text.replace(/<color=(#[0-9a-fA-F]{6})FF>(.*?)<\/color>/g, '{{color|$1|$2}}');
  }

  text = text.replace(/\{REALNAME\[ID\(1\)(\|HOSTONLY\(true\))?]}/g, '(Wanderer)');

  if (!plaintext) {
    text = text.replace(/\{SPRITE_PRESET#(\d+)}/g, (fm: string, g1: string) => {
      let image = SPRITE_TAGS[parseInt(g1)].Image;
      image = image.split('/').pop();
      return '{{Sprite|' + image + '}}';
    });
  }

  if (text.includes('RUBY#[')) {
    text = convertGenshinRubi(langCode, text);
  }

  text = mergeMcTemplate(text, langCode, plaintext);

  if (/\|s1:/.test(text)) {
    let parts = text.split(/\|s\d+:/);
    if (sNum && sNum <= parts.length - 1) {
      text = parts[sNum];
    } else {
      text = parts[0];
    }
  }

  return text;
};