import { create, Request, Response, Router } from '../../util/router';
import { getControl } from '../../scripts/script_util';
import { MainQuestExcelConfigData } from '../../../shared/types/quest-types';
import { isInt, toInt } from '../../../shared/util/numberUtil';
import { questGenerate, QuestGenerateResult } from '../../scripts/dialogue/quest_generator';
import { isset, removeCyclicRefs } from '../../../shared/util/genericUtil';
import { ApiCyclicValueReplacer } from '../ApiBaseRouter';
import { HttpError } from '../../../shared/util/httpError';
import { DialogueSectionResult } from '../../scripts/dialogue/dialogue_util';
import {
  dialogueGenerate,
  dialogueGenerateByNpc,
  NpcDialogueResultMap,
} from '../../scripts/dialogue/basic_dialogue_generator';
import { reminderGenerate, reminderWikitext } from '../../scripts/dialogue/reminder_generator';
import { getIdFromVoFile } from '../../scripts/textmap';

const router: Router = create();

router.restful('/quests/findMainQuest', {
  get: async (req: Request, res: Response) => {
    let questNameOrId: string|number = <string|number> (req.query.name || req.query.id);

    if (!isset(questNameOrId)) {
      throw HttpError.badRequest('InvalidParameter', 'The "name" or "id" query parameter must be given');
    }

    if (typeof questNameOrId === 'string' && /^\d+$/.test(questNameOrId.trim())) {
      questNameOrId = parseInt(questNameOrId);
    }

    const ctrl = getControl(req);

    let mainQuests: MainQuestExcelConfigData[] = await ctrl.selectMainQuestsByNameOrId(questNameOrId);

    let result: {[id: number]: string} = {};
    for (let mainQuest of mainQuests) {
      if (!mainQuest || !mainQuest.Id)
        continue;
      result[mainQuest.Id] = mainQuest.TitleText;
    }

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      return res.render('partials/quests/quest-search-results', { searchResults: result });
    } else {
      return result;
    }
  }
});

router.restful('/quests/generate', {
  get: async (req: Request, res: Response) => {
    let param: number|string;

    if (req.query.id) {
      param = toInt(req.query.id);
    } else if (req.query.name) {
      param = String(req.query.name);
    }

    const ctrl = getControl(req);
    let result: QuestGenerateResult = await questGenerate(param, ctrl);

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      let locals: any = {};

      locals.isResultPage = true;
      locals.questTitle = result.questTitle;
      locals.questId = result.questId;
      locals.npc = result.npc;
      locals.npcStrList = result.npc ? result.npc.names.join('; ') : '';
      locals.stepsWikitext = result.stepsWikitext;
      locals.questDescriptions = result.questDescriptions;
      locals.otherLanguagesWikitext = result.otherLanguagesWikitext;
      locals.dialogue = result.dialogue;
      locals.travelLogSummary = result.travelLogSummary;
      locals.cutscenes = result.cutscenes;
      locals.reward = result.reward;
      locals.reputation = result.reputation;
      locals.rewardInfobox = result.rewardInfobox;

      return res.render('partials/quests/quest-generate-result', locals);
    } else {
      return removeCyclicRefs(result, ApiCyclicValueReplacer);
    }
  }
});

router.restful('/dialogue/single-branch-generate', {
  get: async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const query = (<string> req.query.text)?.trim();

    if (query.toLowerCase() === 'paimon') {
      throw HttpError.badRequest('UnsupportedOperation', 'Unfortunately, you cannot search for just "Paimon" as the operation would be too intensive.');
    }

    let result: DialogueSectionResult[] = await dialogueGenerate(ctrl, query, <string> req.query.npcFilter);

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      return res.render('partials/dialogue/single-branch-dialogue-generate-result', {
        sections: result,
      });
    } else {
      return removeCyclicRefs(result, ApiCyclicValueReplacer);
    }
  }
});

router.restful('/dialogue/npc-dialogue-generate', {
  get: async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const query = (<string> req.query.name)?.trim();

    switch (query.toLowerCase()) {
      case 'paimon':
      case '1005':
        throw HttpError.badRequest('UnsupportedOperation', 'Unfortunately, NPC dialogue generator does not support Paimon (id: 1005). The operation would be too intensive.');
      case '???':
        throw HttpError.badRequest('UnsupportedOperation', 'Unfortunately, NPC dialogue generator does not support search for "???"');
    }

    let resultMap: NpcDialogueResultMap = await dialogueGenerateByNpc(ctrl, query);

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      return res.render('partials/dialogue/npc-dialogue-result', {
        resultMap: resultMap,
      });
    } else {
      return removeCyclicRefs(resultMap, ApiCyclicValueReplacer);
    }
  }
});

router.restful('/dialogue/reminder-dialogue-generate', {
  get: async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    let subsequentAmount = 0;
    if (isInt(req.query.subsequentAmount)) {
      subsequentAmount = toInt(req.query.subsequentAmount);
    }

    let result: DialogueSectionResult[] = await reminderGenerate(ctrl, <string> req.query.text, subsequentAmount);

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      return res.render('partials/dialogue/single-branch-dialogue-generate-result', {
        sections: result,
      });
    } else {
      return result;
    }
  }
});

router.restful('/dialogue/vo-to-dialogue', {
  get: async (req: Request, res: Response) => {
    const ctrl = getControl(req);
    const inputs: string[] = (<string> req.query.text).trim().split(/\n/g).map(s => s.trim()).filter(s => !!s);
    const results: {id: number, type: string, text: string, file: string}[] = [];

    for (let input of inputs) {
      if (input.toLowerCase().includes('{{a|')) {
        input = /{{A\|(.*?)[|}]/.exec(input)[1].trim();
      }
      if (!input.toLowerCase().endsWith('.ogg')) {
        input += '.ogg';
      }
      input = input.replaceAll('_', ' ');
      input = input.replace('File:', '');

      let result = getIdFromVoFile(input);
      let type = result?.[0];
      let id = result?.[1];
      let text = '';

      if (type === 'Dialog') {
        let dialogue = await ctrl.selectSingleDialogExcelConfigData(id);
        text = await ctrl.generateDialogueWikiText([dialogue]);
      } else if (type === 'Reminder') {
        let reminder = await ctrl.selectReminderById(id);
        text = reminderWikitext(ctrl, reminder);
      }

      results.push({ id, type, text, file: input });
    }

    if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/html') {
      return res.render('partials/dialogue/vo-to-dialogue-result', { results });
    } else {
      return results;
    }
  }
});

export default router;
