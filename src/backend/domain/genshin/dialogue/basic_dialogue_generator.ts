import '../../../loadenv.ts';
import { closeKnex } from '../../../util/db.ts';
import { GenshinControl, getGenshinControl } from '../genshinControl.ts';
import { NpcExcelConfigData } from '../../../../shared/types/genshin/general-types.ts';
import util from 'util';
import { isInt } from '../../../../shared/util/numberUtil.ts';
import {
  DialogExcelConfigData, DialogWikitextResult,
  TalkExcelConfigData,
} from '../../../../shared/types/genshin/dialogue-types.ts';
import { escapeRegExp, trim } from '../../../../shared/util/stringUtil.ts';
import {
  DialogueSectionResult,
  dialogueToQuestId,
  TalkConfigAccumulator,
  talkConfigGenerate,
  dialogTraceBack,
} from './dialogue_util.ts';
import { IMetaPropValue, MetaProp } from '../../../util/metaProp.ts';
import { pathToFileURL } from 'url';
import { Marker } from '../../../../shared/util/highlightMarker.ts';
import { LangCode, TextMapHash } from '../../../../shared/types/lang-types.ts';
import { _ } from 'ag-grid-community';
import { defaultMap } from '../../../../shared/util/genericUtil.ts';
import { reminderGenerateFromSpeakerTextMapHashes } from './reminder_generator.ts';

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

// region Branch Dialogue: Options & State
// --------------------------------------------------------------------------------------------------------------
export type DialogueGenerateOpts = {
  query: number|number[]|string,
  voicedOnly?: boolean;
  npcFilter?: string;
}

export const DIALOGUE_GENERATE_MAX = 100;

class DialogueGenerateState {
  readonly result: DialogueSectionResult[] = [];

  readonly query: number | number[] | string;
  readonly npcFilter: string;
  readonly voicedOnly: boolean;

  readonly seenTalkConfigIds: Set<number> = new Set();
  readonly seenFirstDialogueIds: Set<number> = new Set();

  constructor(readonly ctrl: GenshinControl, opts: DialogueGenerateOpts) {
    this.query = opts.query;

    if (typeof this.query === 'string' && isInt(this.query)) {
      this.query = parseInt(this.query);
    }

    this.npcFilter = normNpcFilterInput(ctrl, opts?.npcFilter, ctrl.inputLangCode);
    this.voicedOnly = opts?.voicedOnly || false;
  }
}
// endregion

// region Branch Dialogue: Logic
// --------------------------------------------------------------------------------------------------------------

function addHighlightMarkers(ctrl: GenshinControl, query: number|number[]|string, dialogue: DialogExcelConfigData, sect: DialogueSectionResult) {
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

async function handle(state: DialogueGenerateState, id: number|DialogExcelConfigData): Promise<boolean> {
  if (!id) {
    return false;
  }

  const {
    result,
    ctrl,

    seenFirstDialogueIds,
    seenTalkConfigIds,

    query,
    voicedOnly,
    npcFilter,
  } = state;

  // Fast case: Talk ID
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

  // Look for dialog excel:
  const dialog: DialogExcelConfigData = typeof id === 'number' ? await ctrl.selectSingleDialogExcelConfigData(id) : id;

  // If no dialog, then there's nothing we can do:
  if (!dialog) {
    throw 'No Talk or Dialogue found for ID: ' + id;
  }

  // If voicedOnly=true and the dialog is not voiced, then do not accept:
  if (voicedOnly && !ctrl.voice.hasVoiceItems('Dialog', dialog.Id)) {
    return false;
  }

  // If input options has an NPC filter and this dialogue is not of that NPC, then do not accept:
  if (!(await npcFilterInclude(ctrl, dialog, npcFilter))) {
    return false;
  }

  // Find Talks (part 1):
  const talkConfigs: TalkExcelConfigData[] = await ctrl.selectTalkExcelConfigDataListByFirstDialogueId(dialog.Id);
  const foundTalkIds: Set<number> = new Set<number>(talkConfigs.map(t => t.Id));

  // Find Talks (part 2):
  const firstDialogs: DialogExcelConfigData[] = await dialogTraceBack(ctrl, dialog);
  for (let d of firstDialogs) {
    const dTalks: TalkExcelConfigData[] = await ctrl.selectTalkExcelConfigDataListByFirstDialogueId(d.Id);
    for (let dTalk of dTalks) {
      if (!foundTalkIds.has(dTalk.Id)) {
        talkConfigs.push(dTalk);
        foundTalkIds.add(dTalk.Id);
      }
    }
  }

  // Find Talks (part 3):
  for (let d of [dialog, ...firstDialogs]) {
    if (isInt(d.TalkId) && !foundTalkIds.has(d.TalkId)) {
      const dTalk = await ctrl.selectTalkExcelConfigDataById(d.TalkId);
      if (dTalk) {
        talkConfigs.push(dTalk);
        foundTalkIds.add(dTalk.Id);
      }
    }
  }

  // Talk Case
  // --------------------------------------------------------------------------------------------------------------
  if (talkConfigs.length) {
    let foundTalks: boolean = false;
    for (let talkConfig of talkConfigs) {
      if (seenTalkConfigIds.has(talkConfig.Id)) {
        continue;
      } else {
        seenTalkConfigIds.add(talkConfig.Id);
      }

      const talkConfigResult = await talkConfigGenerate(ctrl, talkConfig);
      if (!talkConfigResult)
        continue;

      talkConfigResult.metadata.push(new MetaProp('First Dialogue ID', talkConfig.InitDialog));
      if (talkConfig.Dialog?.[0]?.TalkType) {
        talkConfigResult.metadata.push(new MetaProp('First Dialogue Talk Type', talkConfig.Dialog[0].TalkType));
      }
      talkConfigResult.metadata.push(new MetaProp('First Match Dialogue ID', [
        dialog.Id,
        <IMetaPropValue> {
          value: 'OL',
          link: '/OL?q=' + dialog.TalkContentTextMapHash
        }
      ]));
      addHighlightMarkers(ctrl, query, dialog, talkConfigResult);
      result.push(talkConfigResult);
      foundTalks = true;
    }
    return foundTalks;
  }

  // Non-Talk Case
  // --------------------------------------------------------------------------------------------------------------
  else {
    let foundDialogs: boolean = false;
    for (let firstDialog of firstDialogs) {
      if (seenFirstDialogueIds.has(firstDialog.Id)) {
        continue;
      } else {
        seenFirstDialogueIds.add(firstDialog.Id);
      }

      const questIds: number[] = await dialogueToQuestId(ctrl, firstDialog);
      const dialogueBranch = await ctrl.selectDialogBranch(questIds?.[0], firstDialog);
      const sect = new DialogueSectionResult('Dialogue_'+firstDialog.Id, 'Dialogue');
      sect.originalData.dialogBranch = dialogueBranch;
      sect.metadata.push(new MetaProp('First Dialogue ID', firstDialog.Id, `/branch-dialogue?q=${firstDialog.Id}`));
      if (dialog.TalkType) {
        sect.metadata.push(new MetaProp('First Dialogue Talk Type', dialog.TalkType));
      }
      sect.metadata.push(new MetaProp('First Match Dialogue ID', [
        <IMetaPropValue> {
          value: dialog.Id,
          link: `/branch-dialogue?q=${dialog.Id}`,
        },
        <IMetaPropValue> {
          value: 'OL',
          link: '/OL?q=' + dialog.TalkContentTextMapHash
        }
      ]));

      if (questIds.length) {
        sect.metadata.push(new MetaProp('Quest ID', await questIds.asyncMap(async id => ({
          value: id,
          tooltip: await ctrl.selectMainQuestName(id)
        })), '/quests/{}'));
        sect.originalData.questId = questIds[0];
        sect.originalData.questName = await ctrl.selectMainQuestName(questIds[0]);
      }
      const dialogWikitextRet: DialogWikitextResult = await ctrl.generateDialogueWikitext(dialogueBranch);
      sect.wikitext = dialogWikitextRet.wikitext;
      sect.wikitextLineIds = dialogWikitextRet.ids;
      addHighlightMarkers(ctrl, query, dialog, sect);
      result.push(sect);
    }
    return foundDialogs;
  }
}

export async function dialogueGenerate(ctrl: GenshinControl, opts: DialogueGenerateOpts): Promise<DialogueSectionResult[]> {
  const state: DialogueGenerateState = new DialogueGenerateState(ctrl, opts);
  ctrl.state.DisableNpcCache = true;

  if (typeof state.query === 'string') {
    let acceptedCount = 0;
    for await (let textMapHash of ctrl.generateTextMapMatches(state.query.trim())) {
      const dialogues: DialogExcelConfigData[] = await ctrl.selectDialogsFromTextMapHash(textMapHash);
      const didAccept: boolean = (await dialogues.asyncMap(d => handle(state, d))).some(b => !!b);
      if (didAccept) {
        acceptedCount++;
      }
      if (acceptedCount > DIALOGUE_GENERATE_MAX) {
        break;
      }
    }
  } else if (typeof state.query === 'number') {
    await handle(state, state.query);
  } else {
    await state.query.asyncMap(id => handle(state, id));
  }

  return state.result;
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

    for (let dialogue of await ctrl.selectDialogExcelConfigDataByTalkRoleId(npc.Id, true)) {
      if (ctrl.isInDialogIdCache(dialogue)) {
        continue;
      } else {
        ctrl.saveToDialogIdCache(dialogue);
      }

      const questId: number = (await dialogueToQuestId(ctrl, dialogue))?.[0];
      const dialogueBranch = await ctrl.selectDialogBranch(questId, dialogue);
      const sect = new DialogueSectionResult('Dialogue_'+dialogue.Id, 'Dialogue');
      sect.originalData.dialogBranch = dialogueBranch;
      sect.metadata.push(new MetaProp('First Dialogue ID', dialogue.Id, `/branch-dialogue?q=${dialogue.Id}`));
      if (dialogue.TalkType) {
        sect.metadata.push(new MetaProp('First Dialogue Talk Type', dialogue.TalkType));
      }

      const dialogWikitextRet: DialogWikitextResult = await ctrl.generateDialogueWikitext(dialogueBranch);
      sect.wikitext = dialogWikitextRet.wikitext.trim();
      sect.wikitextLineIds = dialogWikitextRet.ids;

      if (questId) {
        const questName = await ctrl.selectMainQuestName(questId);
        sect.addMetaProp('Quest ID', {value: questId, tooltip: questName}, '/quests/{}');
        sect.originalData.questId = questId;
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
