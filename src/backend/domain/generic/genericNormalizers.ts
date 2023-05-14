import { LangCode } from '../../../shared/types/lang-types';
import { wordRejoin, wordSplit } from '../../../shared/util/stringUtil';
import { toInt } from '../../../shared/util/numberUtil';

export type McPlaceholderProvider = (langCode: LangCode, degender?: boolean) => string;

export type McPlainTextMode = 'both' | 'male' | 'female';

export type TextNormalizer = (text: string, langCode: LangCode, decolor?: boolean, plaintext?: boolean, plaintextMcMode?: McPlainTextMode) => string;

export function mergeMcTemplate(text: string, langCode: LangCode, plaintext: boolean): string {
  if (langCode && !plaintext && text.includes('{{MC')) {
    const mcParts = [];

    const textForWordSplit = text.replaceAll(/\{\{MC\|.*?}}/g, s => {
      const i = mcParts.length;
      mcParts.push(s);
      return `__MCTMPL${i}__`;
    });

    const words = wordSplit(langCode, textForWordSplit).map(word => {
      word.segment = word.segment.replaceAll(/__MCTMPL(\d+)__/g, (fm: string, g1: string) => mcParts[toInt(g1)]);

      if (word.segment.includes('{{MC')) {
        word.segment = word.segment.replace(/(.*)\{\{MC\|m=(.*?)\|f=(.*?)}}(.*)/g, (fm: string, before: string, maleText: string, femaleText: string, after: string) => {
          let suffix = '';
          if (maleText.endsWith(`'s`) && femaleText.endsWith(`'s`)) {
            maleText = maleText.slice(0, -2);
            femaleText = femaleText.slice(0, -2);
            suffix = `'s`;
          }
          return `{{MC|m=${before}${maleText}${after}|f=${before}${femaleText}${after}}}${suffix}`;
        });
      }

      return word;
    });

    text = wordRejoin(words);

    // Merge multiple subsequent {{MC}} with only spaces between:
    const regex = /\{\{MC\|m=((?:.(?<!\{\{MC))*?)\|f=((?:.(?<!\{\{MC))*?)}}(\s*)\{\{MC\|m=(.*?)\|f=(.*?)}}/;
    while (regex.test(text)) {
      text = text.replace(regex, (s, maleText1, femaleText1, whitespace, maleText2, femaleText2) => {
        return `{{MC|m=${maleText1}${whitespace}${maleText2}|f=${femaleText1}${whitespace}${femaleText2}}}`;
      });
    }
  }
  return text;
}

export function genericNormText(text: string, langCode: LangCode, decolor: boolean, plaintext: boolean,
                                plaintextMcMode: McPlainTextMode, mcPlaceholderProvider: McPlaceholderProvider): string {
  if (!text) {
    return text;
  }

  text = text.replace(/—/g, plaintext ? '-' : '&mdash;').trim();
  text = text.replace(/{NICKNAME}/g, mcPlaceholderProvider(langCode, true));
  text = text.replace(/{NON_BREAK_SPACE}/g, plaintext ? ' ' : '&nbsp;');
  text = text.replace(/\u00A0/g, plaintext ? ' ' : '&nbsp;');
  text = text.replace(/<size=[^>]+>(.*?)<\/size>/gs, '$1');
  text = text.replace(/<i>(.*?)<\/i>/gs, plaintext ? '$1' : `''$1''`);
  text = text.replace(/<\/?c\d>/g, '');

  if (plaintext) {
    if (plaintextMcMode === 'male') {
      text = text.replace(/{F#([^}]*)}{M#([^}]*)}/g, '$2');
      text = text.replace(/{M#([^}]*)}{F#([^}]*)}/g, '$1');
    } else if (plaintextMcMode === 'female') {
      text = text.replace(/{F#([^}]*)}{M#([^}]*)}/g, '$1');
      text = text.replace(/{M#([^}]*)}{F#([^}]*)}/g, '$2');
    } else {
      text = text.replace(/{F#([^}]*)}{M#([^}]*)}/g, '($2/$1)');
      text = text.replace(/{M#([^}]*)}{F#([^}]*)}/g, '($1/$2)');
    }
  } else {
    text = text.replace(/{F#([^}]*)}{M#([^}]*)}/g, '{{MC|m=$2|f=$1}}');
    text = text.replace(/{M#([^}]*)}{F#([^}]*)}/g, '{{MC|m=$1|f=$2}}');
  }

  if (decolor || plaintext) {
    text = text.replace(/<color=#[^>]+>(.*?)<\/color>/gs, '$1');
  }

  if (!plaintext) {
    text = text.replace(/« /g, '«&nbsp;');
    text = text.replace(/ »/g, '&nbsp;»');
    text = text.replace(/(?<=\S) (:|%|\.\.\.)/g, '&nbsp;$1');
  }

  text = text.replace(/\\"/g, '"');
  text = text.replace(/\r/g, '');
  text = text.replace(/\\?\\n|\\\n|\n/g, plaintext ? '\n' : '<br />')
    .replace(/<br \/><br \/>/g, '\n\n');

  if (text.startsWith('#')) {
    text = text.slice(1);
  }

  return text;
}