import { listen } from '../../../util/eventListen.ts';
import { VoAppState } from './vo-tool.ts';
import { flashTippy } from '../../../util/tooltipUtil.ts';
import { copyTextToClipboard, downloadObjectAsJson, downloadTextAsFile } from '../../../util/domutil.ts';
import { ModalRef, modalService } from '../../../util/modalService.ts';
import { ucFirst } from '../../../../shared/util/stringUtil.ts';
import { resolveObjectPath } from '../../../../shared/util/arrayUtil.ts';
import { LANG_CODE_TO_WIKI_CODE, LangCode } from '../../../../shared/types/lang-types.ts';
import { VoAppPreloadOptions } from './vo-preload-types.ts';
import { setOutputLanguage } from '../../../core/userPreferences/siteLanguage.ts';

export async function VoAppToolbar(state: VoAppState): Promise<void> {
  if (!state.avatar)
    return;

  function overwriteModal(type: 'story' | 'combat') {
    if (!state.voiceOverGroup) {
      alert('Voice-overs not yet loaded. Please wait a bit and then retry.');
      return;
    }
    let opts: VoAppPreloadOptions = {};

    const createFieldModeOption = (field: string, paramFillProp?: string): string => {
      return `
        <div class="w33p">
          <fieldset class="spacer5-all">
            <legend><code>${field}</code> field mode</legend>
            <div class="field spacer5-horiz" style="padding-right:30px">
              <label class="ui-radio dispBlock" style="padding-left:5px;font-size:13px;">
                <input type="radio" name="paramFill.${paramFillProp || field}" value="fill" checked />
                <span>Filled</span>
              </label>
              <label class="ui-radio dispBlock" style="padding-left:5px;font-size:13px;">
                <input type="radio" name="paramFill.${paramFillProp || field}" value="remove" />
                <span>Removed</span>
              </label>
              <label class="ui-radio dispBlock" style="padding-left:5px;font-size:13px;">
                <input type="radio" name="paramFill.${paramFillProp || field}" value="empty" />
                <span>Empty</span>
              </label>
            </div>
          </fieldset>
        </div>
      `;
    }

    modalService.confirm(`Preload ${ucFirst(type)} Template`, `
          <div class="info-notice">
            <p>This will <em>completely</em> overwrite any existing wikitext you have for the VO ${ucFirst(type)} template.
            Any wikitext outside of the template will be unaffected.</p>
            <p>If you don't already have the template, then it'll append it to the end.</p>
          </div>
          <fieldset class="spacer10-top">
            <legend>Preload Options</legend>
            <div class="field spacer5-horiz" style="padding-right:30px">
              <label class="ui-checkbox dispBlock" style="padding-left:5px;font-size:13px;">
                <input type="checkbox" name="swapTitleSubtitle" value="true" />
                <span>Swap <code>title/tx</code> and <code>subtitle/tl</code> values when applicable.</span>
              </label>
            </div>
            <div class="content spacer10-top" style="padding-bottom:0;">
              <hr class="spacer10-bottom opacity50p" />
              <p>The options below apply after any field swaps if swapping is enabled.</p>
              <div class="dispFlex flexWrap spacer10-top">
                ${createFieldModeOption('title')}
                ${createFieldModeOption('subtitle')}
                ${createFieldModeOption('file')}
                ${createFieldModeOption('tl')}
                ${createFieldModeOption('tx', 'tx*')}
              </div>
            </div>
          </fieldset>
        `, {
      modalClass: 'modal-lg',
      contentClass: 'modal-inset'
    }).onConfirm((ref: ModalRef) => {
      ref.outerEl.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(inputEl => {
        if (inputEl.checked) {
          resolveObjectPath(opts, inputEl.name, 'set', true);
        }
      });
      ref.outerEl.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach(inputEl => {
        if (inputEl.checked) {
          resolveObjectPath(opts, inputEl.name, 'set', inputEl.value);
        }
      });
      state.eventBus.emit('VO-Wikitext-OverwriteFromVoiceOvers', type, opts);
    });
  }
  listen([
    {
      selector: '.vo-app-language-option',
      event: 'click',
      multiple: true,
      handle: function(event, target) {
        let targetValue = target.getAttribute('data-value');
        state.eventBus.emit('VO-Lang-Changed', targetValue as LangCode);
      }
    },
    {
      selector: '.vo-app-interfacelang-option',
      event: 'click',
      multiple: true,
      handle: function(event, target) {
        let targetValue = target.getAttribute('data-value');
        setOutputLanguage(targetValue as LangCode);
      }
    },
    {
      selector: '#vo-app-load-fromWikitext',
      event: 'click',
      handle: function() {
        let tabButton = document.querySelector<HTMLButtonElement>('#tab-wikitext');
        tabButton.click();
        let wikitext = document.querySelector<HTMLElement>('#wikitext-editor');
        flashTippy(wikitext, {content: 'Paste the wikitext here!', delay:[0,2000]});
      }
    },
    {
      selector: '#vo-app-load-from-story',
      event: 'click',
      handle: function() {
        if (!state.voiceOverGroup) {
          alert('Voice-overs not yet loaded. Please wait a bit and then retry.');
          return;
        }
        overwriteModal('story');
      }
    },
    {
      selector: '#vo-app-load-from-combat',
      event: 'click',
      handle: function() {
        if (!state.voiceOverGroup) {
          alert('Voice-overs not yet loaded. Please wait a bit and then retry.');
          return;
        }
        overwriteModal('combat');
      }
    },
    {
      selector: '#vo-app-export-copyText',
      event: 'click',
      handle: function() {
        state.eventBus.emit('VO-Wikitext-RequestValue', (value: string) => {
          copyTextToClipboard(value);

          let exportButton = document.querySelector<HTMLButtonElement>('#vo-app-export-button');
          flashTippy(exportButton, {content: 'Copied!', delay:[0,2000]});
        });
      }
    },
    {
      selector: '#vo-app-export-saveFile',
      event: 'click',
      handle: function() {
        state.eventBus.emit('VO-Wikitext-RequestValue', (value: string) => {
          let wtAvatarName = state.avatar.NameText.replace(/ /g, '_');
          let wtLangCode = LANG_CODE_TO_WIKI_CODE[state.voLang];
          downloadTextAsFile(`${wtAvatarName}_${wtLangCode}.wt`, value);
        });
      }
    },
    {
      selector: '#vo-app-export-json',
      event: 'click',
      handle: function() {
        if (!state.voiceOverGroup) {
          alert('Voice-overs not yet loaded. Please wait a bit and then retry.');
          return;
        }
        let wtAvatarName = state.avatar.NameText.replace(/ /g, '_');
        downloadObjectAsJson(state.voiceOverGroup.original, `${wtAvatarName}_VoiceOvers.json`, 2);
      }
    }
  ]);
}
