import { genshinEndpoints } from '../../../endpoints.ts';
import { pageMatch } from '../../../pageMatch.ts';
import { startGenericSearchPageListeners } from '../../genericSearchPage.ts';

pageMatch('pages/genshin/dialogue/vo-to-dialogue', () => {
  startGenericSearchPageListeners({
    endpoint: genshinEndpoints.voToDialogue,
    
    inputs: [
      {
        selector: '.search-input',
        apiParam: 'text',
        queryParam: 'q',
        disableEnterKeySubmit: true
      }
    ],

    submitPendingTarget: '.search-submit-pending',
    submitButtonTarget: '.search-submit',
    resultTarget: '#search-result',
  });
});