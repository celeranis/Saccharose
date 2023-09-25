import '../../../loadenv';
import { closeKnex } from '../../../util/db';
import { cached } from '../../../util/cache';
import { pathToFileURL } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import {
  AtlasUnlockData, AvatarConfig,
  VoiceAtlas,
  VoiceAtlasGroup,
  VoiceAtlasGroupByAvatar,
} from '../../../../shared/types/hsr/hsr-avatar-types';
import {
  getStarRailControl,
  loadStarRailVoiceItems,
  normalizeStarRailVoicePath,
  StarRailControl,
} from '../starRailControl';
import { DATAFILE_HSR_VOICE_ATLASES } from '../../../loadenv';
import { defaultMap } from '../../../../shared/util/genericUtil';
import { toMap } from '../../../../shared/util/arrayUtil';

export async function fetchVoiceAtlases(ctrl: StarRailControl, skipCache: boolean = false): Promise<VoiceAtlasGroupByAvatar> {
  if (!skipCache) {
    return cached('StarRail_VoiceAtlasGroup', async () => {
      const filePath = path.resolve(process.env.HSR_DATA_ROOT, DATAFILE_HSR_VOICE_ATLASES);
      const result: VoiceAtlasGroupByAvatar = await fs.readFile(filePath, {encoding: 'utf8'})
        .then(data => JSON.parse(data));
      return result;
    });
  }

  ctrl = ctrl.copy();
  ctrl.state.AutoloadAvatar = false;
  ctrl.state.AutoloadText = false;

  const avatarMap: {[avatarId: number]: AvatarConfig} = toMap(await ctrl.selectAllAvatars(), 'Id');

  return cached('StarRail_VoiceAtlasGroup', async () => {
    let voiceAtlases: VoiceAtlas[] = await ctrl.readExcelDataFile('VoiceAtlas.json');
    let voiceAtlasGroupByAvatar: {[avatarId: number]: VoiceAtlasGroup} =
      defaultMap((avatarId: number) => new VoiceAtlasGroup(avatarId));

    let unlockData: {[unlockId: number]: AtlasUnlockData} = await ctrl.readExcelDataFileToStream<AtlasUnlockData>('AtlasUnlockData.json')
      .toMap('UnlockId');

    for (let voiceAtlas of voiceAtlases) {
      let agg = voiceAtlasGroupByAvatar[voiceAtlas.AvatarId];

      if (!agg.avatarName) {
        agg.avatarName = await ctrl.createLangCodeMap(avatarMap[voiceAtlas.AvatarId].NameTextMapHash);
      }

      if (voiceAtlas.AudioId) {
        voiceAtlas.VoiceItem = ctrl.voice.getVoiceItem(voiceAtlas.AudioId);
      } else if (voiceAtlas.AudioEvent) {
        voiceAtlas.VoiceItem = {
          id: 0,
          fileName: normalizeStarRailVoicePath(voiceAtlas.AudioEvent),
          isGendered: false,
          type: 'Archive'
        }
      }
      if (voiceAtlas.Unlock) {
        voiceAtlas.UnlockData = unlockData[voiceAtlas.Unlock];
      }

      if (voiceAtlas.IsBattleVoice) {
        agg.combatAtlases.push(voiceAtlas);
      } else {
        agg.storyAtlases.push(voiceAtlas);
      }

      if (voiceAtlas.VoiceTitleTextMapHash) {
        voiceAtlas.VoiceTitleTextMap = await ctrl.createLangCodeMap(voiceAtlas.VoiceTitleTextMapHash);
      }
      if (voiceAtlas.VoiceMTextMapHash) {
        voiceAtlas.VoiceMTextMap = await ctrl.createLangCodeMap(voiceAtlas.VoiceMTextMapHash);
      }
      if (voiceAtlas.UnlockDescTextMapHash && !(await ctrl.isEmptyTextMapItem(ctrl.outputLangCode, voiceAtlas.UnlockDescTextMapHash))) {
        voiceAtlas.UnlockDescTextMap = await ctrl.createLangCodeMap(voiceAtlas.UnlockDescTextMapHash);
      }
      if (voiceAtlas.VoiceFTextMapHash && !(await ctrl.isEmptyTextMapItem(ctrl.outputLangCode, voiceAtlas.VoiceFTextMapHash))) {
        voiceAtlas.VoiceFTextMap = await ctrl.createLangCodeMap(voiceAtlas.VoiceFTextMapHash);
      }
    }

    return voiceAtlasGroupByAvatar;
  });
}

export async function fetchVoiceAtlasByAvatarId(ctrl: StarRailControl, avatarId: number): Promise<VoiceAtlasGroup> {
  return (await fetchVoiceAtlases(ctrl))[avatarId];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await loadStarRailVoiceItems();

    const ctrl = getStarRailControl();

    console.inspect(await fetchVoiceAtlases(ctrl, true));

    await closeKnex();
  })();
}