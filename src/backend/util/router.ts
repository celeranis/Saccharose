// noinspection JSUnusedGlobalSymbols

import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import availableMethods from '../middleware/api/availableMethods';
import * as express from 'express';
import * as expressCore from 'express-serve-static-core';
import {
  printHumanTiming,
  icon,
  dragHandle,
  printTimestamp,
  toParam,
  spriteTagIconize,
} from './viewUtilities';
import { cachedSync } from './cache';
import crypto from 'crypto';
import {
  camelCaseToTitleCase,
  escapeHtml,
  escapeHtmlAllowEntities,
  ltrim, removePrefix,
  removeSuffix, replacePrefix, replaceSuffix,
  sentenceJoin,
  snakeToTitleCase, snakeToUpperCamelCase, splitCamelcase, titleCase, toLower, toUpper, ucFirst,
} from '../../shared/util/stringUtil';
import { getWebpackBundleFileNames, WebpackBundles } from './webpackBundle';
import { EJS_DELIMITER, getNodeEnv, SITE_TITLE, VIEWS_ROOT } from '../loadenv';
import { CompareTernary, ternary, toBoolean } from '../../shared/util/genericUtil';
import { toInt } from '../../shared/util/numberUtil';
import { Marker } from '../../shared/util/highlightMarker';
import pluralize from 'pluralize';
import { SEARCH_MODES, SearchMode } from './searchUtil';
import { DEFAULT_LANG, LANG_CODES, LANG_CODES_TO_NAME, LangCode } from '../../shared/types/lang-types';
import createHtmlElement from 'create-html-element';

//#region Types
export type IncludeFunction = (view: string, locals?: RequestLocals) => string;

export type RequestLocals = ((req: Request, res: Response) => object)|object;

export type RequestViewStack = {
  parent?: RequestViewStack;
  viewName?: string,
  subviewName?: string;
  subviewStack?: RequestViewStack;
  include?: IncludeFunction,
  use?: IncludeFunction,
  [prop: string]: any;
};

export type RequestSiteMode = 'genshin' | 'hsr' | 'zenless';

/** The only instance of this type should be at `req.context` */
class RequestContext {
  private _req: Request;
  title: string;
  styles: any[];
  scripts: any[];
  bodyClass: string[];
  viewStack: RequestViewStack;
  viewStackPointer: RequestViewStack;
  nonce = crypto.randomBytes(16).toString('hex');
  webpackBundles: WebpackBundles;
  htmlMetaProps: {[name: string]: string} = {};
  siteMode: RequestSiteMode;

  constructor(req: Request) {
    this._req = req;
    this.title = '';
    this.styles = [];
    this.scripts = [];
    this.bodyClass = [];
    this.viewStack = {viewName: 'RouterRootView'};
    this.viewStackPointer = this.viewStack;
    this.webpackBundles = getWebpackBundleFileNames();

    if (req.path.toLowerCase().startsWith('/hsr')) {
      this.siteMode = 'hsr';
    } else if (req.path.toLowerCase().startsWith('/zenless')) {
      this.siteMode = 'zenless';
    } else {
      this.siteMode = 'genshin';
    }
  }

  get siteHome() {
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

  get siteModeName() {
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

  get siteModeCssClass() {
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


  templateLink(template: string): string {
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
    return '{{' + createHtmlElement({
      name: 'a',
      attributes: {
        href: 'https://' + wikiDomain + '/wiki/Template:' + template.replaceAll(' ', '_'),
        target: '_blank',
        style: 'text-decoration:none'
      },
      text: template
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

  getQuerySettings(): {prop: string, value: string}[] {
    let out = [];
    if (typeof this._req.query['input'] === 'string' && (LANG_CODES as string[]).includes(this._req.query['input'])) {
      out.push({prop: 'Input Language', value: this._req.query['input']});
    }
    if (typeof this._req.query['output'] === 'string' && (LANG_CODES as string[]).includes(this._req.query['output'])) {
      out.push({prop: 'Output Language', value: this._req.query['output']});
    }
    if (typeof this._req.query['searchMode'] === 'string' && (SEARCH_MODES as string[]).includes(this._req.query['searchMode'])) {
      out.push({prop: 'Search Mode', value: this._req.query['searchMode']});
    }
    return out;
  }
}

export type StringSupplier = string|((req: Request) => Promise<string>);
export type ListSupplier = any|any[]|((req: Request) => Promise<any|any[]>);
export type StringListSupplier = string|string[]|((req: Request) => Promise<string|string[]>);

/**
 * RequestContextUpdate is used to make updates to req.context
 */
export type RequestContextUpdate = {
  title?: StringSupplier;
  layouts?: StringListSupplier;
  styles?: ListSupplier;
  scripts?: ListSupplier;
  bodyClass?: StringListSupplier;
  locals?: RequestLocals;
};

export type Request = express.Request & {
  context: RequestContext,
  params: expressCore.Params & {
    [key: string]: any;
  }
};
export type Response = {
  csv: (data: any, csvHeaders?: boolean, headers?: any, statusCode?: number) => Response,
  render(view: string, options?: RequestLocals, callback?: (err: Error, html: string) => void, throwOnError?: boolean): Promise<string|Error>,
} & express.Response;
export type NextFunction = express.NextFunction;
export type RequestHandler = express.RequestHandler;

export type RouterRestfulHandlers = {
  get?: (req: Request, res: Response, next: NextFunction) => void,
  post?: (req: Request, res: Response, next: NextFunction) => void,
  put?: (req: Request, res: Response, next: NextFunction) => void,
  delete?: (req: Request, res: Response, next: NextFunction) => void,
  error?: (err: any, req: Request, res: Response, next: NextFunction) => void,
};

export type Router = express.Router & {
  restful: (route: string|string[], handlers: RouterRestfulHandlers) => void,
};
//#endregion

export function resolveViewPath(view: string): string {
  view = removeSuffix(view, '.ejs');
  view = ltrim(view, '/\\');
  return path.resolve(VIEWS_ROOT, view + '.ejs');
}

export const DEFAULT_GLOBAL_LOCALS = {
  icon,
  dragHandle,
  printTimestamp,
  printHumanTiming,
  ternary,
  escapeHtml,
  escapeHtmlAllowEntities,
  spriteTagIconize,
  pluralize: (s: string) => typeof s === 'string' ? pluralize(s) : s,
  env: process.env,
  toBoolean: toBoolean,
  toInt: toInt,
  Marker: Marker,
  toParam: toParam,

  ucFirst,
  toLower,
  toUpper,
  removePrefix,
  removeSuffix,
  replacePrefix,
  replaceSuffix,
  sentenceJoin,
  titleCase,
  camelCaseToTitleCase,
  snakeToTitleCase,
  snakeToUpperCamelCase,
  splitCamelcase,
};

function createIncludeFunction(req: Request, viewStackPointer: RequestViewStack): IncludeFunction {
  return function include(view: string, locals: RequestLocals = {}): string {
    const viewPath = resolveViewPath(view);
    const viewContent = process.env.NODE_ENV === 'development'
      ? fs.readFileSync(viewPath, 'utf8')
      : cachedSync(`viewContent:${viewPath}`, () => fs.readFileSync(viewPath, 'utf8'));

    return ejs.render(
      viewContent,
      Object.assign({
        include,
        use: include,
        req,
        hasBodyClass: req.context.hasBodyClass.bind(req.context),
        bodyClassTernary: req.context.bodyClassTernary.bind(req.context),
        cookieTernary: req.context.cookieTernary.bind(req.context),
        cookie: req.context.cookie.bind(req.context),
        siteHome: req.context.siteHome,
      }, DEFAULT_GLOBAL_LOCALS, viewStackPointer, typeof locals !== 'object' ? {} : locals),
      { delimiter: EJS_DELIMITER }
    );
  };
}

async function mergeReqContextList(req: Request, prop: string, mergeIn?: StringListSupplier): Promise<void> {
  if (!req.context[prop]) {
    req.context[prop] = [];
  }
  if (mergeIn) {
    req.context[prop] = req.context[prop].concat(typeof mergeIn === 'function' ? await mergeIn(req) : mergeIn);
  }
}

export async function updateReqContext(req: Request, res: Response, ctx: Readonly<RequestContextUpdate>) {
  if (!req.context) {
    req.context = new RequestContext(req);
  }

  await mergeReqContextList(req, 'styles', ctx.styles);
  await mergeReqContextList(req, 'scripts', ctx.scripts);
  await mergeReqContextList(req, 'bodyClass', ctx.bodyClass);

  if (ctx.title) {
    req.context.title = typeof ctx.title === 'function' ? await ctx.title(req) : ctx.title;
  }

  let locals: RequestLocals = ctx.locals;
  let layouts: StringListSupplier = ctx.layouts;

  if (typeof locals === 'function') {
    locals = await locals(req, res);
  }

  let numLayoutsProcessed = 0;

  if (layouts) {
    if (typeof layouts === 'function') {
      layouts = await layouts(req);
    }
    if (!Array.isArray(layouts)) {
      layouts = [layouts];
    }
    layouts.forEach(viewName => {
      if (locals && typeof locals === 'object')
        Object.assign(req.context.viewStackPointer, locals);

      req.context.viewStackPointer.subviewName = viewName;

      req.context.viewStackPointer.include = createIncludeFunction(req, req.context.viewStackPointer);
      req.context.viewStackPointer.use = req.context.viewStackPointer.include;

      // copy down to child view b/c child views should inherit the locals of the parent view
      req.context.viewStackPointer.subviewStack = Object.assign({}, req.context.viewStackPointer, {
        viewName: viewName,
        subviewName: undefined,
        subviewStack: undefined,
        parent: req.context.viewStackPointer,
      });
      req.context.viewStackPointer = req.context.viewStackPointer.subviewStack;
      numLayoutsProcessed++;
    });
  }

  if (!numLayoutsProcessed && locals && typeof locals === 'object') {
    Object.assign(req.context.viewStackPointer, locals);
  }
}

/**
 * Create an Express Router.
 *
 * @param {RequestContextUpdate} [context]
 * @returns {Router}
 */
export function create(context?: Readonly<RequestContextUpdate>): Router {
  const router: Router = express.Router() as Router;

  router.use(async function defaultMiddleware(req: Request, res: Response, next: NextFunction) {
    if (context)
      await updateReqContext(req, res, context);

    res.render = async function(view: string, locals?: RequestLocals, callback?: (err: Error, html: string) => void, throwOnError: boolean = true): Promise<string|Error> {
      try {
        await updateReqContext(req, res, {
          locals,
          layouts: view,
          title: locals && (<any> locals).title,
          styles: locals && (<any> locals).styles,
          scripts: locals && (<any> locals).scripts,
          bodyClass: locals && (<any> locals).bodyClass,
        });

        const rendered = req.context.viewStack.include(req.context.viewStack.subviewName, req.context.viewStack.subviewStack);
        res.set('Content-Type', 'text/html');
        res.send(rendered);

        if (typeof callback === 'function') {
          callback(null, rendered);
        }
        return rendered;
      } catch (e) {
        if (typeof callback === 'function') {
          callback(e, null);
        }
        if (throwOnError) {
          throw e;
        } else if (req.next) {
          req.next(e);
        }
        return e;
      }
    };

    next();
  });

  router.restful = function(route: string|string[], handlers: RouterRestfulHandlers) {
    let tmp = router.route(route);

    Object.keys(handlers).forEach(method => {
      tmp[method](async (req: Request, res: Response, next: NextFunction) => {
        try {
          let data = await handlers[method](req, res, next);

          if (res.headersSent) {
            return;
          }

          if (typeof data === 'undefined') {
            res.status(204).send();
          } else {
            if (req.headers.accept && req.headers.accept.toLowerCase() === 'text/csv') {
              res.csv(Array.isArray(data) ? data : [data], true);
            } else {
              res.json(data);
            }
          }
        } catch (err) {
          if (handlers.error) {
            await handlers.error(err, req, res, next);
          } else {
            next(err);
          }
        }
      });
    });

    if (!handlers.hasOwnProperty('options')) {
      tmp.all(availableMethods(204, Object.keys(handlers)));
    }

    if (!handlers.hasOwnProperty('all')) {
      tmp.all(availableMethods(405, Object.keys(handlers)));
    }
  };

  return router;
}