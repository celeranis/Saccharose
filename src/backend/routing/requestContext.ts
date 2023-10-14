import crypto from 'crypto';
import { getWebpackBundleFileNames, WebpackBundles } from './webpackBundle';
import createHtmlElement from 'create-html-element';
import { getNodeEnv, SITE_TITLE } from '../loadenv';
import { CompareTernary, ternary } from '../../shared/util/genericUtil';
import { DEFAULT_LANG, LANG_CODES, LANG_CODES_TO_NAME } from '../../shared/types/lang-types';
import { SEARCH_MODES } from '../util/searchUtil';
import { Request } from 'express';
import {
  RequestLocals,
  RequestViewStack,
} from './routingTypes';
import { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

export type RequestSiteMode = 'genshin' | 'hsr' | 'zenless';

/**
 * A payload object used to make updates to {@link RequestContext}
 */
export type RequestContextUpdate = {
  title?: string | ((req: Request) => Promise<string>);
  layouts?: (string|ReactElement)[];
  bodyClass?: string[];
  locals?: RequestLocals;
};

/**
 * Only one instance per request. This class may hold information about the request as well as have some utility
 * methods.
 */
export class RequestContext {
  private _req: Request;

  // Data Properties:
  title: string;
  bodyClass: string[];
  htmlMetaProps: { [name: string]: string } = {};
  siteMode: RequestSiteMode;

  // Internal Views:
  viewStack: RequestViewStack;
  viewStackPointer: RequestViewStack;
  virtualStaticViews: {[vname: string]: string} = {};
  private virtualStaticViewCounter: number = 0;

  // Technical Properties:
  nonce = crypto.randomBytes(16).toString('hex');
  webpackBundles: WebpackBundles;

  constructor(req: Request) {
    this._req = req;
    this.title = '';
    this.bodyClass = [];
    this.viewStack = { viewName: 'RouterRootView' };
    this.viewStackPointer = this.viewStack;
    this.webpackBundles = getWebpackBundleFileNames();

    if (req.path.toLowerCase().startsWith('/hsr')) {
      this.siteMode = 'hsr';
    } else if (req.path.toLowerCase().startsWith('/zenless')) {
      this.siteMode = 'zenless';
    } else {
      this.siteMode = 'genshin';
    }
    this.htmlMetaProps['x-site-mode'] = this.siteMode;
    this.htmlMetaProps['x-site-mode-home'] = this.siteHome;
    this.htmlMetaProps['x-site-mode-name'] = this.siteModeName;
    this.htmlMetaProps['x-site-mode-wiki-domain'] = this.siteModeWikiDomain;
  }

  createStaticVirtualView(html: string|ReactElement): string {
    const viewName = 'virtual-static-views/' + this.virtualStaticViewCounter++;
    if (typeof html !== 'string') {
      html = renderToString(html);
    }
    this.virtualStaticViews[viewName] = html;
    return viewName;
  }

  get siteHome(): string {
    switch (this.siteMode) {
      case 'hsr':
        return '/hsr';
      case 'zenless':
        return '/zenless';
      case 'genshin':
      default:
        return '';
    }
  }

  get siteModeName(): string {
    switch (this.siteMode) {
      case 'hsr':
        return 'Honkai Star Rail';
      case 'zenless':
        return 'Zenless Zone Zero';
      case 'genshin':
      default:
        return 'Genshin Impact';
    }
  }

  get siteModeCssClass(): string {
    switch (this.siteMode) {
      case 'hsr':
        return 'page--hsr';
      case 'zenless':
        return 'page--zenless';
      case 'genshin':
      default:
        return 'page--genshin';
    }
  }

  get siteModeWikiDomain(): string {
    let wikiDomain: string;
    switch (this.siteMode) {
      case 'hsr':
        wikiDomain = 'honkai-star-rail.fandom.com';
        break;
      case 'zenless':
        wikiDomain = 'zenless-zone-zero.fandom.com';
        break;
      case 'genshin':
      default:
        wikiDomain = 'genshin-impact.fandom.com';
        break;
    }
    return wikiDomain;
  }

  templateLink(template: string): string {
    return '{{' + createHtmlElement({
      name: 'a',
      attributes: {
        href: 'https://' + this.siteModeWikiDomain + '/wiki/Template:' + template.replaceAll(' ', '_'),
        target: '_blank',
        style: 'text-decoration:none',
      },
      text: template,
    }) + '}}';
  }

  get isDevelopment() {
    return getNodeEnv() === 'development';
  }

  get isProduction() {
    return getNodeEnv() === 'production';
  }

  getAllViewNames() {
    let pointer: RequestViewStack = this.viewStack;
    let names = [];
    while (pointer) {
      names.push(pointer.viewName);
      pointer = pointer.subviewStack;
    }
    return names;
  }

  canPopViewStack(): boolean {
    return this.viewStackPointer.parent && this.viewStackPointer.parent.viewName !== 'RouterRootView';
  }

  popViewStack(): boolean {
    if (!this.canPopViewStack()) {
      return false;
    }
    this.viewStackPointer = this.viewStackPointer.parent;
    this.viewStackPointer.subviewName = undefined;
    this.viewStackPointer.subviewStack = undefined;
    return true;
  }

  hasBodyClass(bodyClass: string) {
    return this.bodyClass.includes(bodyClass);
  }

  bodyClassTernary(bodyClass: string, ifIncludes?: any, ifNotIncludes?: any): any {
    return this.hasBodyClass(bodyClass) ? (ifIncludes || '') : (ifNotIncludes || '');
  }

  cookie(cookieName: string, orElse: string = '') {
    let cookieValue: string = this._req.cookies[cookieName];
    return cookieValue || orElse;
  }

  cookieTernary(cookieName: string): CompareTernary<string> {
    let cookieValue: string = this._req.cookies[cookieName];
    return ternary(cookieValue).setDefaultElse('');
  }

  get siteTitle() {
    return SITE_TITLE;
  }

  getFormattedPageTitle(customTitle?: string) {
    if (!customTitle) {
      customTitle = this.title;
    }
    return customTitle ? `${customTitle} | ${SITE_TITLE}` : SITE_TITLE;
  }

  get bodyClassString() {
    return this.bodyClass ? this.bodyClass.join(' ') : '';
  }

  get languages() {
    let copy = Object.assign({}, LANG_CODES_TO_NAME);
    delete copy['CH'];
    return copy;
  }

  get inputLangCode() {
    return this._req.cookies['inputLangCode'] || DEFAULT_LANG;
  }

  get outputLangCode() {
    return this._req.cookies['outputLangCode'] || DEFAULT_LANG;
  }

  hasQuerySettings() {
    return this._req.query['input'] || this._req.query['output'] || this._req.query['searchMode'];
  }

  getQuerySettings(): { prop: string, value: string }[] {
    let out = [];
    if (typeof this._req.query['input'] === 'string' && (LANG_CODES as string[]).includes(this._req.query['input'])) {
      out.push({ prop: 'Input Language', value: this._req.query['input'] });
    }
    if (typeof this._req.query['output'] === 'string' && (LANG_CODES as string[]).includes(this._req.query['output'])) {
      out.push({ prop: 'Output Language', value: this._req.query['output'] });
    }
    if (typeof this._req.query['searchMode'] === 'string' && (SEARCH_MODES as string[]).includes(this._req.query['searchMode'])) {
      out.push({ prop: 'Search Mode', value: this._req.query['searchMode'] });
    }
    return out;
  }
}