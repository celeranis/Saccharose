// noinspection JSUnusedGlobalSymbols

import { AbstractControl, AbstractControlState } from '../abstractControl';
import { DATAFILE_HSR_VOICE_ITEMS, getStarRailDataFilePath } from '../../loadenv';
import { normalizeRawJson, SchemaTable } from '../../importer/import_db';
import {
  LangCode,
  TextMapHash,
  VoiceItem,
  VoiceItemFlatMap,
} from '../../../shared/types/lang-types';
import { __normStarRailText } from './starRailText';
import path from 'path';
import { promises as fs } from 'fs';
import { defaultMap } from '../../../shared/util/genericUtil';
import { LoadingDesc } from '../../../shared/types/hsr/hsr-misc-types';
import { sort } from '../../../shared/util/arrayUtil';
import { NormTextOptions } from '../generic/genericNormalizers';
import { Request } from 'express';
import { logInitData } from '../../util/logger';
import { AvatarConfig } from '../../../shared/types/hsr/hsr-avatar-types';

// region Control State
// --------------------------------------------------------------------------------------------------------------

/**
 * State/cache for only a single control
 */
export class StarRailControlState extends AbstractControlState {
  // Cache:
  avatarCache:   {[Id: number]: AvatarConfig} = {};

  // Preferences:
  DisableAvatarCache: boolean = false;
}

export function getStarRailControl(request?: Request) {
  return new StarRailControl(request);
}
// endregion

// region Control Object
// --------------------------------------------------------------------------------------------------------------
export class StarRailControl extends AbstractControl<StarRailControlState> {
  // region Constructor
  readonly voice: StarRailVoice;

  constructor(request?: Request) {
    super('hsr', StarRailControlState, request);
    this.excelPath = './ExcelOutput';
    this.disabledLangCodes.add('IT');
    this.disabledLangCodes.add('TR');
  }

  override getDataFilePath(file: string): string {
    return getStarRailDataFilePath(file);
  }

  override normText(text: string, langCode: LangCode, opts: NormTextOptions = {}): string {
    if (!opts) opts = {};
    if (this.outputLangCode === 'EN') {
      opts.mcPlaceholderForceLangCode = 'EN';
    }
    return __normStarRailText(text, langCode, opts);
  }
  // endregion

  // region Post Process
  override async postProcess<T>(object: T, triggerNormalize?: SchemaTable, doNormText: boolean = false): Promise<T> {
    if (!object)
      return object;
    if (triggerNormalize) {
      object = normalizeRawJson(object, triggerNormalize);
    }
    const objAsAny = object as any;
    for (let prop in object) {
      if (prop.endsWith('MapHash') || prop.endsWith('MapHashList')) {
        let textProp: string = prop.endsWith('List') ? prop.slice(0, -11) + 'List' : prop.slice(0, -7);
        if (Array.isArray(object[prop])) {
          let newOriginalArray = [];
          object[textProp] = [];
          for (let id of <any[]>object[prop]) {
            let text = await this.getTextMapItem(this.outputLangCode, id);
            if (doNormText) {
              text = this.normText(text, this.outputLangCode);
            }
            if (text) {
              object[textProp].push(text);
              newOriginalArray.push(id);
            }
          }
          objAsAny[prop] = newOriginalArray;
        } else {
          let text = await this.getTextMapItem(this.outputLangCode, <TextMapHash> object[prop]);
          if (doNormText) {
            text = this.normText(text, this.outputLangCode);
          }
          if (!!text) {
            object[textProp] = text;
          }
        }
      }
    }
    return object;
  }
  // endregion

  // region Avatars
  private async postProcessAvatar(avatar: AvatarConfig): Promise<AvatarConfig> {
    avatar.BaseTypeData = await this.knex.select('*').from('AvatarBaseType')
      .where({Id: avatar.BaseType}).first().then(this.commonLoadFirst);
    return avatar;
  }

  async selectAllAvatars(): Promise<AvatarConfig[]> {
    return await this.knex.select('*').from('AvatarConfig')
      .then(this.commonLoad)
      .then((avatars: AvatarConfig[]) => avatars.asyncMap(a => this.postProcessAvatar(a)));
  }

  async selectAvatarById(id: number): Promise<AvatarConfig> {
    if (this.state.avatarCache.hasOwnProperty(id)) {
      return this.state.avatarCache[id];
    }
    let avatar: AvatarConfig = await this.knex.select('*').from('AvatarConfig')
      .where({Id: id}).first().then(this.commonLoadFirst);
    avatar = await this.postProcessAvatar(avatar);
    if (!this.state.DisableAvatarCache) {
      this.state.avatarCache[id] = avatar;
    }
    return avatar;
  }
  // endregion

  async getLoadingTips(): Promise<{[category: string]: string[]}> {
    const out: {[category: string]: string[]} = defaultMap('Array');

    let loadingTips: LoadingDesc[] = await this.readExcelDataFile('./LoadingDesc.json');
    sort(loadingTips, 'TitleText', 'DescText');

    for (let loadingTip of loadingTips) {
      let title = this.normText(loadingTip.TitleText, this.outputLangCode);
      let desc = this.normText(loadingTip.DescText, this.outputLangCode);

      out[title].push(desc);
    }

    return out;
  }
}
// endregion

// region Voice Items
// --------------------------------------------------------------------------------------------------------------

const HSR_VOICE_ITEMS: VoiceItemFlatMap = {};

export type StarRailVoiceItemType = 'Archive' | 'Cutscene' | 'NPC_Far' | 'NPC_Near' | 'NPC_Normal';

interface StarRailVoiceConfig {
  IsPlayerInvolved: boolean,
  VoiceId: number,
  VoicePath: string,
  VoiceType?: string,
}

export async function loadStarRailVoiceItems(): Promise<void> {
  logInitData('Loading HSR Voice Items -- starting...');

  const voiceItemsFilePath = path.resolve(process.env.HSR_DATA_ROOT, DATAFILE_HSR_VOICE_ITEMS);
  const result: StarRailVoiceConfig[] = await fs.readFile(voiceItemsFilePath, {encoding: 'utf8'}).then(data => JSON.parse(data));

  for (let item of result) {
    HSR_VOICE_ITEMS[item.VoiceId] = {
      id: item.VoiceId,
      fileName: item.VoicePath.replace(/_/g, ' ').toLowerCase() + '.ogg',
      isGendered: item.IsPlayerInvolved,
      type: item.VoiceType
    };
  }

  Object.freeze(HSR_VOICE_ITEMS);
  logInitData('Loading HSR Voice Items -- done!');
}

export class StarRailVoice {

  getVoiceItemsByType(type: StarRailVoiceItemType): VoiceItem[] {
    let items: VoiceItem[] = [];
    for (let item of Object.values(HSR_VOICE_ITEMS)) {
      if (item.type === type) {
        items.push(item)
      }
    }
    return items;
  }

  getVoiceItemByFile(voFile: string): VoiceItem {
    voFile = voFile.toLowerCase();
    for (let item of Object.values(HSR_VOICE_ITEMS)) {
      if (item.fileName === voFile) {
        return item;
      }
    }
    return null;
  }

  getVoiceItem(id: number|string): VoiceItem {
    return HSR_VOICE_ITEMS[id];
  }

  getVoPrefix(id: number|string, text?: string): string {
    let voItem: VoiceItem = HSR_VOICE_ITEMS[id];
    let voPrefix = '';
    if (voItem) {
      let tmp = [];

      if (voItem.isGendered && (!text || (/{{MC/i.test(text)))) {
        tmp.push(`{{A|${voItem.fileName} M}}`);
        tmp.push(`{{A|${voItem.fileName} F}}`);
      } else {
        tmp.push(`{{A|${voItem.fileName}}}`);
      }

      return tmp.join(' ') + ' ';
    }
    return voPrefix;
  }
}
// endregion