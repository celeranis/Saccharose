import { RequestContext } from './requestContext.ts';
import { NextFunction, Request, Response } from 'express';
import { Component } from '@vue/runtime-core';

import { SiteUser } from '../../shared/types/site/site-user-types.ts';

declare module 'express-serve-static-core' {
  interface Request {
    context: RequestContext,
    user: SiteUser,
  }
  interface Response {
    //csv(data: any, csvHeaders?: boolean, headers?: any, statusCode?: number): Response,
    render(view: string|Component, options?: object, callback?: (err: Error, html: string) => void): void;
  }
  interface Router {
    endpoint(route: string | string[], handlers: RouterRestfulHandlers): void,
  }
}

export type IncludeFunction = (view: string, locals?: RequestLocals) => string;

export type RequestLocals = ((req: Request, res: Response) => any) | any;

export type RequestViewStack = {
  parent?: RequestViewStack;
  viewName?: string,
  subviewName?: string;
  subviewStack?: RequestViewStack;
  include?: IncludeFunction,
  use?: IncludeFunction,
  [prop: string]: any;
};

export type RouterRestfulHandlers = {
  get?: (req: Request, res: Response, next: NextFunction) => void,
  post?: (req: Request, res: Response, next: NextFunction) => void,
  put?: (req: Request, res: Response, next: NextFunction) => void,
  delete?: (req: Request, res: Response, next: NextFunction) => void,
  error?: (err: any, req: Request, res: Response, next: NextFunction) => void,
};
