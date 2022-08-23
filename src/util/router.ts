//#region Imports
import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import config from '@/config';
import availableMethods from '@/middleware/availableMethods';
import * as functions from '@functions';
import * as express from 'express';
import * as expressCore from 'express-serve-static-core';
import { icon, timestamp, humanTiming, compileResourceElement, Tl } from '@/util/view_utilities';
import { cachedSync } from '@cache';
import crypto from 'crypto';
//#endregion

//#region Types

export type IncludeFunction = (view: string, locals?: any) => string;

export type RequestSubViewLocals = {
  subview?: string;
  sublocals?: RequestSubViewLocals;
  include?: IncludeFunction,
  [prop: string]: any;
};

/** The only instance of this type should be at req.context */
class RequestContext {
  title: string;
  styles: any[];
  scripts: any[];
  bodyClass: string[];
  viewStack: RequestSubViewLocals;
  viewStackPointer: RequestSubViewLocals;
  nonce = crypto.randomBytes(16).toString('hex');

  constructor() {
    this.title = '';
    this.styles = [];
    this.scripts = [];
    this.bodyClass = [];
    this.viewStack = {};
    this.viewStackPointer = this.viewStack;
  }

  get formattedPageTitle() {
    return config.views.formatPageTitle(config.views.siteTitle, this.title);
  }

  get bodyClassString() {
    return this.bodyClass ? this.bodyClass.join(' ') : '';
  }

  get currentGenshinVersion() {
    return config.currentGenshinVersion;
  }
};

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
  locals?: any;
};

export type RequestLocals = {
  [prop: string]: any;
};

export type Request = express.Request & {
  context: RequestContext,
  params: expressCore.Params & {
    [key: string]: any;
  }
};
export type Response = express.Response & {
  csv: (data: any, csvHeaders?: boolean, headers?: any, statusCode?: number) => Response
};
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
  view = functions.remove_suffix(view, '.ejs');
  view = functions.ltrim(view, '/\\');
  return path.resolve(config.views.root, view + '.ejs');
}

export const DEFAULT_GLOBAL_LOCALS = {
  compileResourceElement,
  icon,
  config,
  functions,
  timestamp,
  humanTiming,
  Tl,
};

function createIncludeFunction(req: Request, viewStackPointer: RequestSubViewLocals): IncludeFunction {
  return function include(view: string, locals={}): string {
    const viewPath = resolveViewPath(view);
    const viewContent = process.env.NODE_ENV === 'development'
      ? fs.readFileSync(viewPath, 'utf8')
      : cachedSync(`viewContent:${viewPath}`, () => fs.readFileSync(viewPath, 'utf8'));

    return ejs.render(
      viewContent,
      Object.assign({
        include,
        req,
      }, DEFAULT_GLOBAL_LOCALS, viewStackPointer, typeof locals !== 'object' ? {} : locals),
      { delimiter: config.views.ejsDelimiter }
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

export async function updateReqContext(req: Request, ctx: Readonly<RequestContextUpdate>) {
  if (!req.context) {
    req.context = new RequestContext();
  }

  mergeReqContextList(req, 'styles', ctx.styles);
  mergeReqContextList(req, 'scripts', ctx.scripts);
  mergeReqContextList(req, 'bodyClass', ctx.bodyClass);

  if (ctx.title) {
    req.context.title = typeof ctx.title === 'function' ? await ctx.title(req) : ctx.title;
  }

  let locals: any = ctx.locals;
  let layouts: StringListSupplier = ctx.layouts;

  if (typeof locals === 'function') {
    locals = await locals(req);
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

      req.context.viewStackPointer.subview = viewName;

      req.context.viewStackPointer.include = createIncludeFunction(req, req.context.viewStackPointer);

      // copy down to child view b/c child views should inherit the locals of the parent view
      req.context.viewStackPointer.sublocals = Object.assign({}, req.context.viewStackPointer, {subview: undefined, sublocals: undefined});
      req.context.viewStackPointer = req.context.viewStackPointer.sublocals;
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
  const router = require('express').Router();

  router.use(async function defaultMiddleware(req: Request, res: Response, next: NextFunction) {
    if (context)
      await updateReqContext(req, context);

    res.render = async function(view: string, locals?: any, callback?: (err: Error, html: string) => void): Promise<void> {
      await updateReqContext(req, {
        locals,
        layouts: view,
        title: locals && locals.title,
        styles: locals && locals.styles,
        scripts: locals && locals.scripts,
        bodyClass: locals && locals.bodyClass,
      });

      const rendered = req.context.viewStack.include(req.context.viewStack.subview, req.context.viewStack.sublocals);
      res.set('Content-Type', 'text/html');
      res.send(rendered);

      if (typeof callback === 'function') {
        callback(null, rendered);
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
};