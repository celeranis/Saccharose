import '../../../loadenv';
import { closeKnex } from '../../../util/db';
import { GenshinControl, getGenshinControl } from '../genshinControl';
import { NpcExcelConfigData } from '../../../../shared/types/genshin/general-types';
import util from 'util';
import { isInt } from '../../../../shared/util/numberUtil';
import { DialogExcelConfigData, TalkExcelConfigData } from '../../../../shared/types/genshin/dialogue-types';
import { escapeRegExp, trim } from '../../../../shared/util/stringUtil';
import {
  DialogueSectionResult,
  dialogueToQuestId,
  TalkConfigAccumulator,
  talkConfigGenerate,
  dialogTraceBack,
} from './dialogue_util';
import { MetaProp } from '../../../util/metaProp';
import { pathToFileURL } from 'url';
import { Marker } from '../../../../shared/util/highlightMarker';
import { LangCode, TextMapHash } from '../../../../shared/types/lang-types';
import { _ } from 'ag-grid-community';
import { defaultMap } from '../../../../shared/util/genericUtil';
import { reminderGenerateFromSpeakerTextMapHashes } from './reminder_generator';

// region NPC Filtering for Single Branch Dialogue
// --------------------------------------------------------------------------------------------------------------
const lc = (s: string) => s ? s.toLowerCase() : s;

function normNpcFilterInput(ctrl: GenshinControl, npcFilterInput: string, langCode: LangCode): string {
  if (!npcFilterInput)
    return undefined;
  return lc(trim(ctrl.normText(npcFilterInput, langCode), '()').trim());
}

const npcFilterInclude = async (ctrl: GenshinControl, d: DialogExcelConfigData, npcFilter: string): Promise<boolean> => {
  if (!d) {
    return false;
  }
  if (npcFilter === 'player' || npcFilter === 'traveler') {
    return d.TalkRole.Type === 'TALK_ROLE_PLAYER';
  }
  if (npcFilter === 'sibling') {
    return d.TalkRole.Type === 'TALK_ROLE_MATE_AVATAR';
  }
  let npcNameOutputLang = lc(trim(ctrl.normText(d.TalkRoleNameText, ctrl.outputLangCode), '()'));
  let npcNameInputLang = lc(trim(ctrl.normText(await ctrl.getTextMapItem(ctrl.inputLangCode, d.TalkRoleNameTextMapHash), ctrl.inputLangCode), '()'));
  if (!npcFilter) {
    return true;
  }
  return npcNameOutputLang === npcFilter || npcNameInputLang === npcFilter;
};
// endregion

// region Single Branch Dialogue
// --------------------------------------------------------------------------------------------------------------
export const DIALOGUE_GENERATE_MAX = 100;

export async function dialogueGenerate(ctrl: GenshinControl, query: number|number[]|string, npcFilter?: string): Promise<DialogueSectionResult[]> {
  let result: DialogueSectionResult[] = [];
  npcFilter = normNpcFilterInput(ctrl, npcFilter, ctrl.inputLangCode);

  if (typeof query === 'string' && isInt(query)) {
    query = parseInt(query);
  }

  ctrl.state.DisableNpcCache = true;

  function addHighlightMarkers(dialogue: DialogExcelConfigData, sect: DialogueSectionResult) {
    let re: RegExp;
    let reFlags: string = ctrl.searchModeFlags.includes('i') ? 'gi' : 'g';
    let isRegexQuery: boolean = ctrl.searchMode === 'R' || ctrl.searchMode === 'RI';

    if (typeof query === 'string' && ctrl.inputLangCode === ctrl.outputLangCode) {
      re = new RegExp(isRegexQuery ? `(?<=:''' .*)` + query : escapeRegExp(ctrl.normText(query, ctrl.outputLangCode)), reFlags);
    } else {
      re = new RegExp(escapeRegExp(ctrl.normText(dialogue.TalkContentText, ctrl.outputLangCode)), reFlags);
    }

    for (let marker of Marker.create(re, sect.wikitext)) {
      sect.wikitextMarkers.push(marker);
    }
  }

  const seenTalkConfigIds: Set<number> = new Set();
  const seenFirstDialogueIds: Set<number> = new Set();

  async function handle(id: number|DialogExcelConfigData): Promise<boolean> {
    if (!id) {
      return false;
    }
    if (typeof id === 'number') {
      if (seenTalkConfigIds.has(id) || seenFirstDialogueIds.has(id)) {
        return false;
      }
      const talkConfigResult = await talkConfigGenerate(ctrl, id);
      if (talkConfigResult) {
        result.push(talkConfigResult);
        return true;
      }
    }

    const dialogue: DialogExcelConfigData = typeof id === 'number' ? await ctrl.selectSingleDialogExcelConfigData(id) : id;
    if (!dialogue) {
      throw 'No Talk or Dialogue found for ID: ' + id;
    }
    if (!(await npcFilterInclude(ctrl, dialogue, npcFilter))) {
      return false;
    }
    let talkConfigs: TalkExcelConfigData[] = await ctrl.selectTalkExcelConfigDataListByFirstDialogueId(dialogue.Id);
    let firstDialogs: DialogExcelConfigData[] = null;
    if (!talkConfigs.length) {
      firstDialogs = await dialogTraceBack(ctrl, dialogue);
      for (let d of firstDialogs) {
        talkConfigs.push(... await ctrl.selectTalkExcelConfigDataListByFirstDialogueId(d.Id));
      }
    }
    if (talkConfigs.length) {
      let foundTalks: boolean = false;
      for (let talkConfig of talkConfigs) {
        if (seenTalkConfigIds.has(talkConfig.Id)) {
          continue;
        } else {
          seenTalkConfigIds.add(talkConfig.Id);
        }
        const talkConfigResult = await talkConfigGenerate(ctrl, talkConfig);
        if (talkConfigResult) {
          talkConfigResult.metadata.push(new MetaProp('First Dialogue ID', talkConfig.InitDialog));
          talkConfigResult.metadata.push(new MetaProp('First Match Dialogue ID', dialogue.Id));
          addHighlightMarkers(dialogue, talkConfigResult);
          result.push(talkConfigResult);
          foundTalks = true;
        }
      }
      if (foundTalks) {
        return true;
      }
    } else {
      let foundDialogs: boolean = false;
      if (!firstDialogs) {
        firstDialogs = await dialogTraceBack(ctrl, dialogue);
      }
      for (let firstDialog of firstDialogs) {
        if (seenFirstDialogueIds.has(firstDialog.Id)) {
          continue;
        } else {
          seenFirstDialogueIds.add(firstDialog.Id);
        }
        const dialogueBranch = await ctrl.selectDialogBranch(firstDialog);
        const sect = new DialogueSectionResult('Dialogue_'+firstDialog.Id, 'Dialogue');
        sect.originalData.dialogBranch = dialogueBranch;
        sect.metadata.push(new MetaProp('First Dialogue ID', firstDialog.Id, `/branch-dialogue?q=${firstDialog.Id}`));
        sect.metadata.push(new MetaProp('First Match Dialogue ID', dialogue.Id, `/branch-dialogue?q=${dialogue.Id}`));

        let questIds = await dialogueToQuestId(ctrl, firstDialog);
        if (questIds.length) {
          sect.metadata.push(new MetaProp('Quest ID', await questIds.asyncMap(async id => ({
            value: id,
            tooltip: await ctrl.selectMainQuestName(id)
          })), '/quests/{}'));
          sect.originalData.questId = questIds[0];
          sect.originalData.questName = await ctrl.selectMainQuestName(questIds[0]);
        }
        sect.wikitext = (await ctrl.generateDialogueWikiText(dialogueBranch)).trim();
        addHighlightMarkers(dialogue, sect);
        result.push(sect);
      }
      if (foundDialogs) {
        return true;
      }
    }
    return false;
  }

  if (typeof query === 'string') {
    // string
    let textMapHashes: TextMapHash[] = [];

    await ctrl.streamTextMapMatches(ctrl.inputLangCode, query.trim(),
      (textMapHash: TextMapHash) => textMapHashes.push(textMapHash),
      ctrl.searchModeFlags
    );

    let acceptedCount = 0;
    for (let textMapHash of textMapHashes) {
      let dialogues = await ctrl.selectDialogsFromTextContentId(textMapHash);
      let accepted: boolean = (await dialogues.asyncMap(d => handle(d))).some(b => !!b);
      if (accepted) {
        acceptedCount++;
      }
      if (acceptedCount > DIALOGUE_GENERATE_MAX) {
        break;
      }
    }
  } else if (typeof query === 'number') {
    // number
    await handle(query);
  } else {
    // number[]
    for (let id of query) {
      await handle(id);
    }
  }

  return result;
}
// endregion

// region NPC Dialogue
// --------------------------------------------------------------------------------------------------------------
export class NpcDialogueResultSet {
  resultMap: {[npcId: number]: NpcDialogueResult} = {};
  reminders: DialogueSectionResult[] = [];
}

export class NpcDialogueResult {
  npcId: number;
  npc: NpcExcelConfigData;

  questDialogue: DialogueSectionResult[] = [];
  nonQuestDialogue: DialogueSectionResult[] = [];

  constructor(npc: NpcExcelConfigData) {
    this.npc = npc;
    this.npcId = npc.Id;
  }
}

async function npcListFromInput(ctrl: GenshinControl, npcNameOrId: string|number): Promise<NpcExcelConfigData[]> {
  if (typeof npcNameOrId === 'string' && isInt(npcNameOrId)) {
    npcNameOrId = parseInt(npcNameOrId);
  }

  let npcList: NpcExcelConfigData[] = [];
  if (typeof npcNameOrId === 'string') {
    npcList = await ctrl.selectNpcListByName(npcNameOrId);
  } else {
    let npc = await ctrl.getNpc(npcNameOrId);
    if (!!npc) {
      npcList.push(npc);
    }
  }
  return npcList;
}

export async function dialogueGenerateByNpc(ctrl: GenshinControl,
                                            npcNameOrId: string|number,
                                            acc?: TalkConfigAccumulator,
                                            skipNonIdSpecific: boolean = false): Promise<NpcDialogueResultSet> {
  if (!acc) {
    acc = new TalkConfigAccumulator(ctrl);
  }

  const npcList: NpcExcelConfigData[] = await npcListFromInput(ctrl, npcNameOrId);
  const resultSet: NpcDialogueResultSet = new NpcDialogueResultSet();

  for (let npc of npcList) {
    const res: NpcDialogueResult = new NpcDialogueResult(npc);
    const questIdToSection: {[questId: number]: DialogueSectionResult} = {};

    const getQuestSection = (questId: number, questName: string): DialogueSectionResult => {
      if (questIdToSection[questId]) {
        return questIdToSection[questId];
      }
      const sect = new DialogueSectionResult('Quest_'+questId, questId + ': ' + (questName || '(No title)'));
      sect.originalData.questId = questId;
      sect.originalData.questName = questName;
      questIdToSection[questId] = sect;
      res.questDialogue.push(sect);
      return sect;
    };

    for (let talkConfig of await ctrl.selectTalkExcelConfigDataByNpcId(npc.Id)) {
      const sect = await talkConfigGenerate(ctrl, talkConfig, acc);
      if (sect && sect.originalData.questId) {
        getQuestSection(sect.originalData.questId, sect.originalData.questName).children.push(sect);
      } else if (sect) {
        res.nonQuestDialogue.push(sect);
      }
    }

    for (let dialogue of await ctrl.selectDialogExcelConfigDataByTalkRoleId(npc.Id)) {
      if (ctrl.isInDialogIdCache(dialogue)) {
        continue;
      } else {
        ctrl.saveToDialogIdCache(dialogue);
      }

      const dialogueBranch = await ctrl.selectDialogBranch(dialogue);
      const sect = new DialogueSectionResult('Dialogue_'+dialogue.Id, 'Dialogue');
      sect.originalData.dialogBranch = dialogueBranch;
      sect.metadata.push(new MetaProp('First Dialogue ID', dialogue.Id, `/branch-dialogue?q=${dialogue.Id}`));
      sect.wikitext = (await ctrl.generateDialogueWikiText(dialogueBranch)).trim();

      const questId = await dialogueToQuestId(ctrl, dialogue);
      if (questId.length) {
        const questName = await ctrl.selectMainQuestName(questId[0]);
        sect.addMetaProp('Quest ID', {value: questId[0], tooltip: questName}, '/quests/{}');
        sect.originalData.questId = questId[0];
        sect.originalData.questName = questName;
        getQuestSection(sect.originalData.questId, sect.originalData.questName).children.push(sect);
      } else {
        res.nonQuestDialogue.push(sect);
      }
    }

    resultSet.resultMap[npc.Id] = res;
  }

  if (!skipNonIdSpecific) {
    const nameHashes: TextMapHash[] = (await Promise.all(npcList.map(npc => ctrl.findTextMapHashesByExactName(npc.NameText)))).flat();
    resultSet.reminders = await reminderGenerateFromSpeakerTextMapHashes(ctrl, nameHashes);
  }

  return resultSet;
}
// endregion

// region CLI Testing
// --------------------------------------------------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    //console.log(await dialogueGenerate(`Uh, why are you two fighting?`));
    //console.log(await talkConfigGenerate(6906901));
    let res = await dialogueGenerateByNpc(getGenshinControl(), 'Arapratap');
    console.log(util.inspect(res, false, null, true));
    await closeKnex();
  })();
}
// endregion