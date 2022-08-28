import '../../setup';
import { closeKnex } from '@db';
import { Control, getControl, grep, nameNormMap, normText } from '@/scripts/script_util';
import config from '@/config';
import {promises as fs} from 'fs';
import { AvatarExcelConfigData, FetterStoryExcelConfigData } from '@types';
import {cached} from '@cache';
import { getTextMapItem, loadTextMaps } from '../textmap';
import util from 'util';
import { escapeHtml } from '@functions';

type GroupedFetterStoryExcelConfigData = {[avatarId: number]: {avatar: AvatarExcelConfigData, fetters: FetterStoryExcelConfigData[]}};

const sep = '</p><!--\n              --><p>';

export async function fetchCharacterStories(ctrl: Control): Promise<GroupedFetterStoryExcelConfigData> {
  const fetters = await cached('FetterStoryExcelConfigData', async () => {
    let json: any[] = await fs.readFile(config.database.getGenshinDataFilePath('./ExcelBinOutput/FetterStoryExcelConfigData.json'), {encoding: 'utf8'})
      .then(data => JSON.parse(data));
    let records: FetterStoryExcelConfigData[] = await ctrl.commonLoad(json);
    for (let fetter of records) {
      if (fetter.openConds && fetter.openConds[0] && fetter.openConds[0].condType === 'FETTER_COND_FETTER_LEVEL') {
        fetter.friendship = fetter.openConds[0].paramList[0];
      }
      fetter.storyContextHtml = '<p>'+fetter.storyContextText.split('\\n').map(s => escapeHtml(normText(s), true)).join(sep)+'</p>';
    }
    return records;
  });

  const groupedFetters = await cached('GroupedFetterStoryExcelConfigData', async () => {
    let out: GroupedFetterStoryExcelConfigData = {};
    for (let fetter of fetters) {
      if (!out.hasOwnProperty(fetter.avatarId)) {
        out[fetter.avatarId] = {avatar: await ctrl.selectAvatarById(fetter.avatarId), fetters: []};
      }
      out[fetter.avatarId].fetters.push(fetter);
    }
    return out;
  });

  return groupedFetters;
}

if (require.main === module) {
  (async () => {
    await loadTextMaps();
    const res = await fetchCharacterStories(getControl());
    console.log(util.inspect(res, false, null, true));
    closeKnex();
  })();
}