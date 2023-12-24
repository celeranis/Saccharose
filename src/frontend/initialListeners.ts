import axios from 'axios';
import Cookies from 'js-cookie';
import {
  copyTextToClipboard, createElement, deleteQueryStringParameter, getHiddenElementBounds, getInputValue,
  getScrollbarWidth,
  hashFlash,
  setQueryStringParameter, tag,
} from './util/domutil.ts';
import { humanTiming, timeConvert } from '../shared/util/genericUtil.ts';
import { modalService } from './util/modalService.ts';
import { enableTippy, flashTippy, getTippyOpts, hideTippy, showTippy } from './util/tooltips.ts';
import { Listener, runWhenDOMContentLoaded, startListeners } from './util/eventLoader.ts';
import { showJavascriptErrorDialog } from './util/errorHandler.ts';
import autosize from 'autosize';
import { isInt } from '../shared/util/numberUtil.ts';
import { escapeHtml } from '../shared/util/stringUtil.ts';
import { highlightReplace, highlightWikitextReplace } from './util/ace/wikitextEditor.ts';
import { GeneralEventBus } from './generalEventBus.ts';
import { languages } from './util/langCodes.ts';
import { DEFAULT_LANG, LangCode } from '../shared/types/lang-types.ts';
import { mwParse } from '../shared/mediawiki/mwParse.ts';
import { MwParamNode, MwTemplateNode } from '../shared/mediawiki/mwTypes.ts';
import { uuidv4 } from '../shared/util/uuidv4.ts';
import { Marker } from '../shared/util/highlightMarker.ts';
import { recalculateAceLinePanelPositions } from './util/ace/listeners/wikitextLineActions.ts';
import SiteMode from './siteMode.ts';

type UiAction = {actionType: string, actionParams: string[]};

function parseUiAction(actionEl: HTMLElement): UiAction[] {
  const actionStr = actionEl.getAttribute('ui-action');
  const result: UiAction[] = [];
  const actions = actionStr.split(';');
  for (let action of actions) {
    if (!action.includes(':')) {
      result.push({actionType: action.trim(), actionParams: []});
      continue;
    }
    const actionType = action.split(':')[0].trim().toLowerCase();
    const actionParams = action.split(':')[1].split(',').map(param => param.trim()).map(param => {
      if (param.startsWith('attr.')) {
        return actionEl.getAttribute(param.slice('attr.'.length));
      } else {
        return param;
      }
    });

    result.push({
      actionType,
      actionParams,
    });
  }
  return result;
}

const allowReadonlyKeys = new Set(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Shift', 'Control ', 'Alt', 'Tab',
  'PageUp', 'PageDown', 'Home', 'End']);

// noinspection JSIgnoredPromiseFromCall
const initial_listeners: Listener[] = [
  {
    ev: 'ready',
    intervalId: null,
    intervalMS: 500,
    fn: function() {
      this.intervalFunction(); // run immediately at start
      this.intervalId = setInterval(this.intervalFunction, this.intervalMS);

      window.onerror = function() {
        return showJavascriptErrorDialog.apply(null, arguments);
      };

      window.addEventListener('unhandledrejection', function (event: PromiseRejectionEvent) {
        return showJavascriptErrorDialog.apply(null, [event.reason]);
      });

      hashFlash();
      window.addEventListener('hashchange', () => hashFlash());

      const csrfElement: HTMLMetaElement = document.querySelector('meta[name="csrf-token"]');
      axios.defaults.headers.common['x-csrf-token'] = csrfElement.content;
      axios.defaults.validateStatus = (status: number) => {
        return status >= 200 && status < 400; // accept 2xx and 3xx as valid
      };
      csrfElement.remove();

      const replaceInUrl: HTMLMetaElement = document.querySelector('meta[name="X-ReplaceInUrl"]');
      if (replaceInUrl) {
        let [oldName, newName] = replaceInUrl.content.split(';');
        window.history.replaceState({}, null, window.location.href
          .replace(oldName, newName)
          .replace(encodeURIComponent(oldName), newName));
      }

      const scrollbarWidth = getScrollbarWidth();
      document.head.insertAdjacentHTML('beforeend',
        `<style>body.mobile-menu-open, body.disable-scroll { margin-right: ${scrollbarWidth}px; }\n` +
        `body.mobile-menu-open #header { padding-right: ${scrollbarWidth}px; }\n` +
        `body.disable-scroll { overflow-y: hidden; }\n` +
        `body.desktop-sticky-header.disable-scroll #header {margin-right: ${scrollbarWidth}px} ` +
        `.collapsed { height: 0; overflow: hidden; }\n` +
        `</style>`
      );

      function langCodeChanged(name: string, value: LangCode) {
        console.log('Language selector: Name='+name+', Value='+value);
        Cookies.set(name, value, { expires: 365 });

        const processOption = (opt: HTMLElement) => {
          let isSelectOption = tag(opt) === 'option';
          let optValue = (opt.hasAttribute('value')
            ? opt.getAttribute('value')
            : opt.getAttribute('data-value')
          ) || opt.textContent;
          if (optValue === value) {
            if (isSelectOption) {
              if (!opt.hasAttribute('selected')) {
                opt.setAttribute('selected', 'selected');
              }
            } else {
              opt.classList.add('selected');
            }
          } else {
            if (isSelectOption) {
              if (opt.hasAttribute('selected')) {
                opt.removeAttribute('selected');
              }
            } else {
              opt.classList.remove('selected');
            }
          }
        }

        const processCurrentValueElement = (el: HTMLElement) => {
          el.setAttribute('data-value', value);
          if (el.hasAttribute('value')) {
            el.setAttribute('value', value);
          }
          if (tag(el) != 'input' && tag(el)!= 'select' && tag(el) !== 'textarea') {
            el.textContent = languages[value];
          }
        };

        let elements = Array.from(document.querySelectorAll(`[name="${name}"], [data-name="${name}"], [data-for="${name}"], [data-control="${name}"]`));
        for (let element of elements) {
          if (tag(element) === 'select') {
            element.querySelectorAll('option').forEach(el => processOption(el));
          } else if (tag(element) === 'span' || tag(element) === 'p' || tag(element) === 'div' || tag(element) === 'section') {
            element.querySelectorAll('.option').forEach(el => processOption(el as HTMLElement));

            if (element.classList.contains('current-value') || element.classList.contains('current-option')) {
              processCurrentValueElement(element as HTMLElement);
            } else {
              element.querySelectorAll('.current-value, .current-option').forEach(el => processCurrentValueElement(el as HTMLElement))
            }
          }
        }
      }

      GeneralEventBus.on('inputLangCodeChanged', (langCode: LangCode) => {
        langCodeChanged('inputLangCode', langCode);
      });
      GeneralEventBus.on('outputLangCodeChanged', (langCode: LangCode) => {
        langCodeChanged('outputLangCode', langCode);
      });
    },

    intervalFunction() {
      document.querySelectorAll<HTMLTextAreaElement>('textarea.wikitext').forEach(el => {
        if (el.closest('.hide'))
          return;
        highlightWikitextReplace(el);
      });
      document.querySelectorAll<HTMLTextAreaElement>('textarea.json').forEach(el => {
        if (el.closest('.hide'))
          return;
        highlightReplace(el, 'ace/mode/json');
      });

      document.querySelectorAll<HTMLTextAreaElement>('textarea.autosize').forEach(el => {
        if (el.closest('.hide')) {
          return;
        }
        el.classList.remove('autosize');
        autosize(el);
      });

      document.querySelectorAll<HTMLElement>('[ui-tippy]').forEach(el => {
        enableTippy(el, getTippyOpts(el, 'ui-tippy'));
      });

      document.querySelectorAll<HTMLElement>('[ui-tippy-hover]').forEach(el => {
        const opts = getTippyOpts(el, 'ui-tippy-hover');
        el.addEventListener('mouseenter', _event => {
          showTippy(el, opts);
        });
        el.addEventListener('mouseleave', _event => {
          hideTippy(el);
        });
      });

      document.querySelectorAll<HTMLElement>('[ui-tippy-flash]').forEach(el => {
        const opts = getTippyOpts(el, 'ui-tippy-flash');
        el.addEventListener('click', _event => {
          flashTippy(el, opts);
        });
      });

      document.querySelectorAll('[contenteditable][readonly]:not(.readonly-contenteditable-processed)').forEach(el => {
        el.classList.add('readonly-contenteditable-processed');
        el.addEventListener('paste', event => {
          event.stopPropagation();
          event.preventDefault();
        });
        el.addEventListener('cut', event => {
          event.stopPropagation();
          event.preventDefault();
        });
        el.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.metaKey || event.ctrlKey || event.altKey || allowReadonlyKeys.has(event.key)) {
            return;
          }
          event.stopPropagation();
          event.preventDefault();
        });
        el.addEventListener('copy', (event: ClipboardEvent) => {
          const selection = document.getSelection();
          if (selection && selection.toString().trim() === el.textContent.trim()) {
            event.clipboardData.setData('text/plain', selection.toString().trim());
            event.preventDefault();
          }
        });
      });

      document.querySelectorAll('.highlighted.ol-result-textarea:not(.ol-result-textarea-processed)').forEach(
        (contentEditableEl: HTMLElement) => {
          contentEditableEl.classList.add('ol-result-textarea-processed');

          if (!SiteMode.isGenshin) {
            return;
          }

          const newParent: HTMLElement = createElement('div', {class: 'posRel'});
          contentEditableEl.insertAdjacentElement('afterend', newParent);
          newParent.append(contentEditableEl);

          const toolbarEl = createElement('div', {
            class: 'posAbs',
            style: 'top: 0; right: 0; font-size: 0;'
          })

          const rmButton = createElement('button', {
            class: 'secondary small',
            text: 'Remove RM',
            style: 'border-bottom-right-radius: 0;'
          })

          const tlButton = createElement('button', {
            class: 'secondary small',
            text: 'Remove TL',
            style: `border-left: 0;border-bottom-left-radius: 0;`
          });

          toolbarEl.append(rmButton);
          toolbarEl.append(tlButton);

          if (contentEditableEl.classList.contains('ol-result-textarea--with-copy-button')) {
            const copyButton = createElement('button', {
              class: 'secondary small',
              text: 'Copy',
              style: `border-left: 0;border-bottom-left-radius: 0;`,
              'ui-tippy-hover': "Click to copy to clipboard",
              'ui-tippy-flash': "{content:'Copied!', delay: [0,2000]}",
            });
            copyButton.addEventListener('click', async () => {
              await copyTextToClipboard(contentEditableEl.querySelector('.ace_static_text_layer').textContent.trim());
            });
            toolbarEl.append(copyButton);
          }

          newParent.append(toolbarEl);

          const createParamRemover = (regex: RegExp, addDefaultHidden: boolean = false) => {
            return (event: MouseEvent) => {
              const text = getInputValue(contentEditableEl);
              const parsed = mwParse(text);
              let templateNode: MwTemplateNode = parsed.findTemplateNodes()
                .find(t => t.templateName.toLowerCase() === 'other_languages');
              templateNode.removeParams(regex);
              if (contentEditableEl.hasAttribute('data-markers')) {
                contentEditableEl.removeAttribute('data-markers');
              }
              templateNode.readjustPropPad(['default_hidden']);
              if (addDefaultHidden) {
                templateNode.getParam(0).afterValueWhitespace.content = '';
                templateNode.addParamAfter(new MwParamNode('|', 'default_hidden', '1', '', '\n'), 0);
              }
              contentEditableEl = highlightWikitextReplace(contentEditableEl, parsed.toString().trim());
              (<HTMLButtonElement> event.target).setAttribute('disabled', '');
            };
          }

          rmButton.addEventListener('click', createParamRemover(/_rm$/));
          tlButton.addEventListener('click', createParamRemover(/_tl$/, true));
        });

      document.querySelectorAll<HTMLElement>('.timestamp.is--formatted.is--unconverted').forEach(el => {
        el.classList.remove('is--unconverted');
        el.classList.add('is--converted');
        el.innerText = timeConvert(parseInt(el.getAttribute('data-timestamp')), el.getAttribute('data-format') || null);
      });

      document.querySelectorAll<HTMLElement>('.timestamp.is--humanTiming').forEach(el => {
        el.innerText = humanTiming(parseInt(el.getAttribute('data-timestamp')));
      });
    },
  },
  {
    el: document,
    ev: 'keydown',
    fn: function(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        document.body.classList.add('keydown-shift');
      } else if (e.key === 'Control') {
        document.body.classList.add('keydown-control');
      } else if (e.key === 'Alt') {
        document.body.classList.add('keydown-alt');
      } else if (e.key === 'Meta') {
        document.body.classList.add('keydown-meta');
      }
    }
  },
  {
    el: document,
    ev: 'keyup',
    fn: function(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        document.body.classList.remove('keydown-shift');
      } else if (e.key === 'Control') {
        document.body.classList.remove('keydown-control');
      } else if (e.key === 'Alt') {
        document.body.classList.remove('keydown-alt');
      } else if (e.key === 'Meta') {
        document.body.classList.remove('keydown-meta');
      }
    }
  },
  {
    el: document,
    ev: 'click',
    fn: function(e: Event) {
      const target: HTMLElement = e.target as HTMLElement;
      const actionEl = target.closest<HTMLElement>('[ui-action]');

      if (!target.closest('#mobile-menu') && !target.closest('#mobile-menu-trigger')
          && document.querySelector('#mobile-menu').classList.contains('active')) {
        document.querySelector<HTMLButtonElement>('#mobile-menu-trigger button').click();
      }

      const qs = <T extends HTMLElement = HTMLElement>(selector: string): T =>
        (selector === 'this' || selector === 'self') ? (actionEl as T): document.querySelector<T>(selector);
      const qsAll = <T extends HTMLElement = HTMLElement>(selector: string): T[] =>
        (selector === 'this' || selector === 'self') ? ([actionEl as T]): Array.from(document.querySelectorAll<T>(selector));

      if (actionEl) {
        const actions: UiAction[] = parseUiAction(actionEl);
        for (let action of actions) {
          let actionType = action.actionType;
          let actionParams = action.actionParams;

          switch (actionType) {
            case 'add-class': {
              let addClassTarget = qs(actionParams[0]);
              if (addClassTarget) {
                for (let cls of actionParams.slice(1)) {
                  addClassTarget.classList.add(cls);
                }
              }
              break;
            }
            case 'remove-class': {
              let removeClassTarget = qs(actionParams[0]);
              if (removeClassTarget) {
                for (let cls of actionParams.slice(1)) {
                  removeClassTarget.classList.remove(cls);
                }
              }
              break;
            }
            case 'toggle-class': {
              let toggleClassTarget = qs(actionParams[0]);
              if (toggleClassTarget) {
                for (let cls of actionParams.slice(1)) {
                  toggleClassTarget.classList.toggle(cls);
                }
              }
              break;
            }
            case 'show': {
              let showEase = 0;
              if (isInt(actionParams[0])) {
                showEase = parseInt(actionParams[0]);
                actionParams = actionParams.slice(1);
              }
              for (let selector of actionParams) {
                const showTarget = qs(selector);
                if (showTarget) {
                  showTarget.classList.remove('hide');
                  setTimeout(() => {
                    showTarget.classList.add('active');
                  }, showEase);
                }
              }
              break;
            }
            case 'hide': {
              let hideEase = 0;
              if (isInt(actionParams[0])) {
                hideEase = parseInt(actionParams[0]);
                actionParams = actionParams.slice(1);
              }
              for (let selector of actionParams) {
                const hideTarget = qs(selector);
                if (hideTarget) {
                  hideTarget.classList.remove('active');
                  setTimeout(() => {
                    hideTarget.classList.add('hide');
                  }, hideEase);
                }
              }
              break;
            }
            case 'toggle-dropdown':
            case 'dropdown': {
              const dropdown = qs(actionParams[0]);
              const bounds = getHiddenElementBounds(dropdown);
              const actionElPosX = actionEl.getBoundingClientRect().left;
              const posRight: boolean = dropdown.classList.contains('right');

              if (posRight || actionElPosX + bounds.width > window.innerWidth) {
                dropdown.style.left = 'auto';
                dropdown.style.right = '0';
                dropdown.style.transformOrigin = 'right top';
              } else {
                dropdown.style.left = '0';
                dropdown.style.right = 'auto';
                dropdown.style.transformOrigin = 'left top';
              }

              if (dropdown) {
                (<any>dropdown)._toggledBy = actionEl;
                if (dropdown.classList.contains('active')) {
                  dropdown.classList.remove('active');
                  actionEl.classList.remove('active');
                  setTimeout(() => dropdown.classList.add('hide'), 110);
                } else {
                  dropdown.classList.remove('hide');
                  setTimeout(() => {
                    dropdown.classList.add('active');
                    actionEl.classList.add('active');
                  });
                }
              }
              break;
            }
            case 'dropdown-close':
            case 'close-dropdown':
            case 'close-dropdowns': {
              qsAll('.ui-dropdown.active').forEach(dropdownEl => {
                const toggledBy = (<any>dropdownEl)._toggledBy;
                dropdownEl.classList.remove('active');
                if (toggledBy) {
                  toggledBy.classList.remove('active');
                }
                setTimeout(() => dropdownEl.classList.add('hide'), 110);
              });
              break;
            }
            case 'toggle': {
              let toggleEase = 0;
              if (isInt(actionParams[0])) {
                toggleEase = parseInt(actionParams[0]);
                actionParams = actionParams.slice(1);
              }
              for (let selector of actionParams) {
                const toggleTarget = qs(selector);
                if (toggleTarget) {
                  (<any>toggleTarget)._toggledBy = actionEl;

                  if (toggleTarget.classList.contains('hide')) {
                    toggleTarget.classList.remove('hide');
                    setTimeout(() => {
                      toggleTarget.classList.add('active');
                      actionEl.classList.add('active');
                    }, toggleEase);
                  } else {
                    toggleTarget.classList.remove('active');
                    actionEl.classList.remove('active');
                    setTimeout(() => {
                      toggleTarget.classList.add('hide');
                    }, toggleEase);
                  }
                }
              }
              break;
            }
            case 'refresh-page': {
              window.location.reload();
              break;
            }
            case 'close-modals': {
              modalService.closeAll();
              break;
            }
            case 'copy': {
              let copyTarget = qs(actionParams[0]);

              if ((<any>copyTarget).value) {
                // noinspection JSIgnoredPromiseFromCall
                copyTextToClipboard((<any>copyTarget).value.trim());
              } else if (copyTarget.hasAttribute('contenteditable')) {
                if (copyTarget.querySelector('.ace_static_text_layer')) {
                  copyTarget = copyTarget.querySelector('.ace_static_text_layer');
                }
                // noinspection JSIgnoredPromiseFromCall
                copyTextToClipboard(copyTarget.textContent.trim());
              } else {
                // noinspection JSIgnoredPromiseFromCall
                copyTextToClipboard(copyTarget.textContent.trim());
              }
              break;
            }
            case 'copy-all': {
              let copyTargets: HTMLInputElement[] = actionParams.map(sel => qsAll<HTMLInputElement>(sel)).flat(Infinity) as HTMLInputElement[];
              let combinedValues: string[] = [];
              let sep = actions.find(a => a.actionType === 'copy-sep')?.actionParams?.[0].replace(/\\n/g, '\n') || '\n';
              if (copyTargets) {
                for (let copyTarget of copyTargets) {
                  if ((<any>copyTarget).value) {
                    combinedValues.push(copyTarget.value.trim());
                  } else if (copyTarget.hasAttribute('contenteditable')) {
                    if (copyTarget.querySelector('.ace_static_text_layer')) {
                      copyTarget = copyTarget.querySelector('.ace_static_text_layer');
                    }
                    console.log('Copy target', copyTarget);
                    combinedValues.push(copyTarget.textContent.trim());
                  } else {
                    combinedValues.push(copyTarget.textContent.trim());
                  }
                }
                // noinspection JSIgnoredPromiseFromCall
                copyTextToClipboard(combinedValues.join(sep));
              }
              break;
            }
            case 'tab': {
              const tabpanel = qs(actionParams[0]);
              const tabgroup = actionParams[1];
              if (tabpanel) {
                tabpanel.classList.remove('hide');
                tabpanel.classList.add('active');
                actionEl.classList.add('active');
              }
              let otherTabEls = qsAll<HTMLElement>('[ui-action*="tab:"]');
              for (let otherTabEl of otherTabEls) {
                let otherTabActions = parseUiAction(otherTabEl);
                for (let otherTabAction of otherTabActions.filter(x => x.actionType === 'tab')) {
                  if (otherTabAction.actionParams[1] == tabgroup && otherTabAction.actionParams[0] !== actionParams[0]) {
                    otherTabEl.classList.remove('active');
                    const otherTabPanel = qs(otherTabAction.actionParams[0]);
                    if (otherTabPanel) {
                      otherTabPanel.classList.remove('active');
                      otherTabPanel.classList.add('hide');
                    }
                  }
                }
              }
              break;
            }
            case 'set-query-param': {
              const kvPairs: string[] = actionParams.map(x => x.split('&')).flat(Infinity) as string[];
              for (let kvPair of kvPairs) {
                let key = kvPair.split('=')[0];
                let value = kvPair.split('=')[1];
                setQueryStringParameter(key, value);
              }
              break;
            }
            case 'delete-query-param': {
              for (let key of actionParams) {
                deleteQueryStringParameter(key);
              }
              break;
            }
            case 'copy-pref-link': {
              const params = new URLSearchParams(window.location.search);

              params.set('input', Cookies.get('inputLangCode') || DEFAULT_LANG);
              params.set('output', Cookies.get('outputLangCode') || DEFAULT_LANG);
              params.set('searchMode', Cookies.get('search-mode') || 'WI');

              const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${params.toString()}`;
              copyTextToClipboard(newUrl);
              break;
            }
            case 'expando': {
              const animId = uuidv4();
              const container = qs(actionParams[0]);

              const inTransition = container.classList.contains('collapsing') || container.classList.contains('expanding');
              if (inTransition) {
                return;
              }

              if (container.classList.contains('collapsed')) {
                actionEl.classList.remove('expand-action');
                actionEl.classList.add('collapse-action');

                actionEl.classList.add('expanded-state');
                actionEl.classList.remove('collapsed-state');

                container.classList.remove('hide');

                let height;
                if (container.hasAttribute('data-original-height')) {
                  // Use data-original-height (if it exists)
                  height = parseInt(container.getAttribute('data-original-height'));
                  container.removeAttribute('data-original-height');
                } else {
                  // Otherwise use scrollHeight, which should be approximately correct.
                  height = container.scrollHeight;
                }
                const styleEl = document.createElement('style');
                const duration = Math.min(500, Math.max(200, height / 5 | 0));

                styleEl.textContent = `
                  .expanding-${animId} { overflow: hidden; animation: expanding-${animId} ${duration}ms ease forwards; }
                  @keyframes expanding-${animId} { 100% { height: ${height}px; } }
                `;
                container.style.height = '0';
                container.style.overflow = 'hidden';

                document.head.append(styleEl);
                container.classList.remove('collapsed');
                container.classList.add('expanding', 'expanding-' + animId);
                setTimeout(() => {
                  container.style.removeProperty('height');
                  container.style.removeProperty('overflow');
                  container.classList.add('expanded');
                  container.classList.remove('expanding', 'expanding-' + animId);
                  styleEl.remove();
                }, duration);
              } else {
                actionEl.classList.add('expand-action');
                actionEl.classList.remove('collapse-action');

                actionEl.classList.remove('expanded-state');
                actionEl.classList.add('collapsed-state');

                const styleEl = document.createElement('style');
                const height = container.getBoundingClientRect().height;
                const duration = Math.min(500, Math.max(200, height / 5 | 0));
                container.setAttribute('data-original-height', String(height));

                styleEl.textContent = `
                  .collapsing-${animId} { overflow: hidden; animation: collapsing-${animId} ${duration}ms ease forwards; }
                  @keyframes collapsing-${animId} { 100% { height: 0; } }
                `;
                container.style.height = height + 'px';
                container.style.overflow = 'hidden';

                document.head.append(styleEl);
                container.classList.remove('expanded');
                container.classList.add('collapsing', 'collapsing-' + animId);
                setTimeout(() => {
                  container.style.removeProperty('height');
                  container.style.removeProperty('overflow');
                  container.classList.add('collapsed');
                  container.classList.remove('collapsing', 'collapsing-' + animId);
                  styleEl.remove();
                  setTimeout(() => {
                    container.classList.add('hide');
                  });
                }, duration);
              }

              break;
            }
            case 'set-cookie': {
              Cookies.set(actionParams[0].trim(), actionParams[1].trim(), { expires: 365 });
              break;
            }
            case 'remove-cookie':
            case 'delete-cookie': {
              Cookies.remove(actionParams[0].trim());
              break;
            }
            case 'lazy-image-click': {
              let a = document.createElement('a');
              a.classList.add('image-loaded');
              a.href = actionEl.getAttribute('data-src');
              a.target = '_blank';

              let div = document.createElement('div');

              let img = document.createElement('img');
              img.src = actionEl.getAttribute('data-src');
              img.style.maxWidth = '100%';

              if (a.hasAttribute('data-name')) {
                a.setAttribute('data-name', decodeURIComponent(a.getAttribute('data-name')));
              } else {
                a.setAttribute('data-name', decodeURIComponent(img.src.split('/').reverse()[0]));
              }

              div.append(img);
              a.append(div);

              actionEl.replaceWith(a);
              break;
            }
            case 'wikitext-indent': {
              if (actionParams[1] !== 'increase' && actionParams[1] !== 'decrease') {
                return;
              }
              const contentEditableEl: HTMLElement = qs(actionParams[0]);
              const indentAction: 'increase' | 'decrease' = actionParams[1];
              let lines: string[] = getInputValue(contentEditableEl).split(/\n/g);

              const lowestIndent = Math.min(... lines.filter(line => line.startsWith(':')).map(line => {
                let indent: string = /^:*/.exec(line)[0];
                return indent.length;
              }));

              if (lowestIndent === 1 && indentAction === 'decrease') {
                flashTippy(actionEl, {content: 'Cannot decrease indent any further.'});
                return;
              }

              if (contentEditableEl.hasAttribute('data-markers')) {
                const markers = Marker.fromJoinedString(contentEditableEl.getAttribute('data-markers'));
                markers.filter(m => !m.fullLine).forEach(m => {
                  if (indentAction === 'decrease') {
                    m.startCol--;
                    m.endCol--;
                  } else {
                    m.startCol++;
                    m.endCol++;
                  }
                });
                contentEditableEl.setAttribute('data-markers', Marker.joinedString(markers));
              }

              lines = lines.map(line => {
                if (!line.startsWith(':')) {
                  return line;
                }
                if (indentAction === 'decrease') {
                  line = line.slice(1);
                } else {
                  line = ':' + line;
                }
                return line;
              });
              highlightWikitextReplace(contentEditableEl, lines.join('\n').trim());
              break;
            }
            default:
              break;
          }
        }
      }

      const parentDropdownEl = target.closest<HTMLElement>('.ui-dropdown');
      document.querySelectorAll<HTMLElement>('.ui-dropdown.active').forEach(dropdownEl => {
        // If we clicked inside the dropdown, don't close it.
        if (dropdownEl === parentDropdownEl) {
          return;
        }

        const toggledBy = (<any> dropdownEl)._toggledBy;

        // If we clicked inside the trigger for the dropdown, don't close it.
        if (toggledBy && (toggledBy === target || toggledBy.contains(target))) {
          return;
        }

        dropdownEl.classList.remove('active');
        if (toggledBy) {
          toggledBy.classList.remove('active');
        }
        setTimeout(() => dropdownEl.classList.add('hide'), 110);
      });
    },
  },
  {
    el: '.toggle-theme-buttons button',
    ev: 'click',
    multiple: true,
    fn: function(event: MouseEvent, target: HTMLButtonElement) {
      let value = target.value;
      console.log('Toggle theme button clicked with value:', value);

      document.querySelectorAll('.toggle-theme-buttons button').forEach(el => el.classList.remove('selected'));
      target.classList.add('selected');

      if (value === 'daymode') {
        document.body.classList.remove('nightmode');
        document.documentElement.classList.remove('nightmode');
        Cookies.remove('nightmode');
        document.querySelectorAll('.os-scrollbar').forEach(scrollbar => {
          scrollbar.classList.remove('os-theme-light');
          scrollbar.classList.add('os-theme-dark');
        });
      } else if (value === 'nightmode') {
        document.body.classList.add('nightmode');
        document.documentElement.classList.add('nightmode');
        Cookies.set('nightmode', '1', { expires: 365 });
        document.querySelectorAll('.os-scrollbar').forEach(scrollbar => {
          scrollbar.classList.remove('os-theme-dark');
          scrollbar.classList.add('os-theme-light');
        });
      }
    }
  },
  {
    el: '.header-language-selector select',
    ev: 'change',
    multiple: true,
    fn: function(event: Event, target: HTMLSelectElement) {
      let name = target.name;
      let value = target.value;
      GeneralEventBus.emit(name + 'Changed', value);
    }
  },
  {
    el: '#search-mode-dropdown .option',
    ev: 'click',
    multiple: true,
    fn: function(event: Event, target: HTMLElement) {
      document.querySelectorAll('#search-mode-dropdown .option').forEach(el => el.classList.remove('selected'));
      target.classList.add('selected');

      let val = target.getAttribute('data-value');
      document.querySelector<HTMLElement>('#search-mode-button .code').innerText = val;
      Cookies.set('search-mode', val, { expires: 365 });
    }
  },
];

export const fileFormatListeners: Listener[] = [
  {
    el: '.file-format-options input[type="radio"]',
    ev: 'input',
    multiple: true,
    fn: function(event, target: HTMLInputElement) {
      let parent = target.closest('.file-format-options');
      let name = target.name;
      let value = target.value;
      Cookies.set(name, value, { expires: 365 });
      if (value === 'custom') {
        parent.querySelector('.file-format-options-custom-format').classList.remove('hide');
      } else {
        parent.querySelector('.file-format-options-custom-format').classList.add('hide');
      }
    }
  },
  {
    el: '.file-format-options-custom-format-input',
    ev: 'input',
    multiple: true,
    fn: function(event, target: HTMLInputElement) {
      let name = target.name;
      let value = target.value;

      clearTimeout((<any> target)._timeout);

      (<any> target)._timeout = setTimeout(() => {
        Cookies.set(name, value, { expires: 365 });
      }, 50);
    }
  },
  {
    el: '.file-format-options .file-format-options-custom-format-help-button',
    ev: 'click',
    multiple: true,
    fn: function(event, target: HTMLInputElement) {
      const paramName = target.closest('.file-format-options').getAttribute('data-param-name');
      const fileFormatDefault = target.closest('.file-format-options').getAttribute('data-file-format-default');
      const params = target.closest('.file-format-options').getAttribute('data-file-format-params').split(',').map(x => x.trim());
      const langCodes = target.closest('.file-format-options').getAttribute('data-lang-codes').split(',').map(x => x.trim());

      modalService.modal(`<span>Custom Format Options for <code>${escapeHtml(paramName)}</code></span>`, `
        <p class="info-notice spacer5-top">
          <strong>English wiki default format for <code>${escapeHtml(paramName)}</code>:</strong><br />
          <textarea class="code autosize w100p" readonly style="background:transparent">${escapeHtml(fileFormatDefault)}</textarea>
        </p>
        <fieldset>
          <legend>Variable usage</legend>
          <div class="content">
            <p class="spacer10-bottom">Variables must be wrapped in single curly braces, for example:<br />
            <code>{NameText.EN} Map Location.png</code></p>
            
            <p class="spacer10-bottom">Alternatively, you can use the syntax:<br />
            <code>{{Var|NameText.EN}} Map Location.png</code></p>
            
            <p class="spacer10-bottom">If you want to specify a default value if a variable is empty, you can specify a second parameter to <code>{{Var}}</code>:<br />
            <code>{{Var|NameText.EN|default value}} Map Location.png</code></p>
            
            <p class="spacer10-bottom">The second parameter will be evaluted the same as the top-level format, so you can have nested conditionals and variables inside.
            Default values cannot be specified with the single curly brace format.</p>
          </div>
        </fieldset>
        <fieldset class="spacer5-top">
          <legend>Available variables:</legend>
          <div class="content spacer20-horiz">
            <ul style="columns:2;">${params.map(param => `<li><code>${escapeHtml(param)}</code></li>`).join('')}</ul>
          </div>
        </fieldset>
        <fieldset class="spacer5-top">
          <legend>Available language codes:</legend>
          <div class="content spacer20-horiz">
            <ul style="columns:5;">${langCodes.map(param => `<li><code>${escapeHtml(param)}</code></li>`).join('')}</ul>
          </div>
        </fieldset>
        <fieldset class="spacer5-top">
          <legend>Specify Specific Language</legend>
          <div class="content">
            <p>For in-game text variables, you can specify a specific language by appending it with <code>.{Langcode}</code>. For example,
            for a <code>NameText</code> param, you can use <code>NameText.JP</code>. Otherwise, without any specific language code, just <code>NameText</code>
            would use your selected <strong>Output Language</strong>.</p>
          </div>
        </fieldset>
        <fieldset class="spacer5-top">
          <legend>Conditionals</legend>
          <div class="content">
            <p>You can use conditionals in the format of:</p>
            
            <br />
            <code class="dispBlock">{{If|&lt;condition&gt;|&lt;then value&gt;|&lt;else value&gt;}}</code>
            <code class="dispBlock spacer20-left">condition = "&lt;left-param&gt; &lt;operator&gt; &lt;right-param&gt;"</code>
            <code class="dispBlock spacer20-left">operator = ":=" | "!=" | "&lt;=" | "&gt;=" | "&lt;" | "&gt;" | "*=" | "^=" | "$=" | "~"</code>
            <br />
            
            <li>The <code>left-param</code> and <code>right-param</code> are evaluated the same as the top-level format,
            so you can use variables inside of them and have nested conditionals.</li>
            
            <li>The <code>condition</code> follows different logic such that variables do not need to be wrapped in curly braces.</li>
            
            <li>Strings do not need to be wrapped in quotes, but you should put them in quotes to prevent them from
            being evaluated as variables or operators.</li>
            
            <li><code>:=</code> is equals whereas <code>!=</code> is not equals.</li>
            
            <li>String condition operators: <code>*=</code> is string includes,
            <code>^=</code> is string starts with, <code>"$="</code> is string ends with, and <code>~=</code> is regex
            (left param is test string, right param is regex).</li>
            
            <li><code>{{If|...}}</code> is case-insensitive. For case-sensitive operations, use <code>{{IfCase|...}}</code> instead.</li>
          </div>
        </fieldset>
      `, {
        modalClass: 'modal-lg',
        modalCssStyle: 'max-height:750px',
        contentClass: 'modal-inset'
      });
    }
  }
]

runWhenDOMContentLoaded(() => {
  startListeners(initial_listeners, document);
  startListeners(fileFormatListeners, document);
});

function recalculateDesktopStickyHeader() {
  let scrollY = window.scrollY;
  let width = window.innerWidth;
  let hasClass = document.body.classList.contains('desktop-sticky-header');

  if (scrollY > 60 && width > 950) {
    if (!hasClass) {
      document.body.classList.add('desktop-sticky-header');
    }
  } else {
    if (hasClass) {
      document.body.classList.remove('desktop-sticky-header');
    }
  }
}

const desktopStickerHeaderListeners: Listener[] = [
  {
    el: 'window',
    ev: 'scroll',
    fn: function(_event) {
      recalculateDesktopStickyHeader();
      document.querySelectorAll('.ace_token-tooltip').forEach(el => el.remove());
    }
  },
  {
    el: 'window',
    ev: 'resize',
    fn: (_event: UIEvent) => {
      recalculateDesktopStickyHeader();
      recalculateAceLinePanelPositions();
    }
  }
];

runWhenDOMContentLoaded(() => {
  startListeners(desktopStickerHeaderListeners, document);
  recalculateDesktopStickyHeader();
});
