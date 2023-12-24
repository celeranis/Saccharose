import './vo-tool-styles.scss';
import Cookies from 'js-cookie';
import { VoAppWelcome } from './vo-app-welcome.ts';
import { VoAppSidebar } from './vo-app-sidebar.ts';
import { VoAppToolbar } from './vo-app-toolbar.ts';
import { VoAppWikitextEditor } from './vo-app-wikitext.ts';
import { VoAppVisualEditor } from './vo-app-visual.ts';
import { EventBus } from '../../../util/eventBus.ts';
import { GeneralEventBus } from '../../../generalEventBus.ts';
import { DEFAULT_LANG, LANG_CODES, LANG_CODES_TO_NAME, LangCode } from '../../../../shared/types/lang-types.ts';
import { CommonAvatar, CommonVoiceOverGroup } from '../../../../shared/types/common-types.ts';
import { VoAppPreloadConfig } from './vo-preload-types.ts';
import { OverlayScrollbars } from 'overlayscrollbars';
import { toBoolean } from '../../../../shared/util/genericUtil.ts';
export interface VoAppConfig {
  storagePrefix: string,
  imagePathPrefix: string,
  fetchVoiceCollection: (avatar: CommonAvatar) => Promise<CommonVoiceOverGroup>,
  isMainCharacter: (avatar: CommonAvatar) => boolean,
  preloadConfig: VoAppPreloadConfig,
}

export class VoAppState {
  avatars: CommonAvatar[];
  avatar: CommonAvatar;
  voiceOverGroup: CommonVoiceOverGroup;
  interfaceLang: LangCode;
  eventBus: EventBus;
  config: VoAppConfig;

  constructor(configSupplier: () => VoAppConfig) {
    this.config = configSupplier();

    this.avatars = (<any> window).avatars;
    this.avatar = (<any> window).avatar;
    this.interfaceLang = (Cookies.get('outputLangCode') as LangCode) || DEFAULT_LANG;
    this.eventBus = new EventBus('VO-App-EventBus');

    if (!LANG_CODES.includes(this.voLang)) {
      this.eventBus.emit('VO-Lang-Changed', DEFAULT_LANG);
    }

    this.scrollInit();
    this.init();
  }

  get voLang(): LangCode {
    return (<any> window).voLangCode;
  }

  set voLang(newCode: LangCode) {
    const prevCode = this.voLang;

    if (newCode === 'CHS' || newCode === 'CHT') {
      newCode = 'CH';
    }
    if (newCode !== 'EN' && newCode !== 'CH' && newCode !== 'JP' && newCode !== 'KR') {
      newCode = 'EN';
    }
    (<any> window).voLangCode = newCode;
    (<any> window).voLangName = LANG_CODES_TO_NAME[newCode];

    console.log(window.location.href, prevCode, newCode);
    window.history.replaceState({}, null,
      window.location.href.replace(new RegExp(`\\/${prevCode}\\b`), `/${newCode}`));
  }

  get voLangName(): string {
    return (<any> window).voLangName;
  }

  isMainCharacter(avatar?: CommonAvatar) {
    return this.config.isMainCharacter(avatar || this.avatar);
  }

  scrollInit() {
    const isNightmode = toBoolean(Cookies.get('nightmode'));
    setTimeout(() => {
      OverlayScrollbars(document.querySelector<HTMLElement>('#vo-tool-sidebar-list'), {
        scrollbars: {
          theme: isNightmode ? 'os-theme-light' : 'os-theme-dark',
          autoHide: 'leave'
        },
        overflow: {
          x: 'hidden'
        }
      });
      OverlayScrollbars(document.querySelector<HTMLElement>('#app-sidebar__content'), {
        scrollbars: {
          theme: isNightmode ? 'os-theme-light' : 'os-theme-dark',
          autoHide: 'leave'
        },
        overflow: {
          x: 'hidden'
        }
      });
    });
  }

  init() {
    this.eventBus.emit('VO-Init-Called', this);

    if (this.avatar) {
      this.config.fetchVoiceCollection(this.avatar).then((collection: CommonVoiceOverGroup) => {
        this.voiceOverGroup = collection;
        this.eventBus.emit('VO-Init-VoiceOversLoaded');
        document.querySelector('#vo-app-loading-status').classList.add('hide');
      });
    }

    GeneralEventBus.on('outputLangCodeChanged', (newLangCode: LangCode) => {
      this.interfaceLang = newLangCode;
    });

    this.eventBus.on('VO-Lang-Changed', (langCode: LangCode) => {
      const prevCode = this.voLang;
      this.voLang = langCode;
      console.log('[VO-App] Lang Code Changed:', 'from', prevCode, 'to', this.voLang, '('+this.voLangName+')');

      if (document.querySelector('#vo-app-toolbar')) {
        document.querySelectorAll('.vo-app-language-option').forEach(el => el.classList.remove('selected'));
        document.querySelector(`.vo-app-language-option[data-value="${langCode}"]`).classList.add('selected');
        document.querySelector('#vo-app-language-current').innerHTML = this.voLangName;
      }

      this.eventBus.emit('VO-Wikitext-LocalLoad');
    });
  }
}

export function initializeVoTool(configSupplier: () => VoAppConfig): void {
  const state = new VoAppState(configSupplier);

  VoAppSidebar(state);
  if (document.querySelector('#vo-app-welcome')) {
    VoAppWelcome(state);
  }
  if (state.avatar) {
    VoAppToolbar(state);
    VoAppVisualEditor(state);
    VoAppWikitextEditor(state);
  }
}