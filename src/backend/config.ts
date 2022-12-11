// THIS CONFIG IS NOT FOR SECRETS
// DO NOT PUT ANY SECRETS OR PRIVATE KEYS IN THIS FILE

// The .env file should be used for secrets. You can access .env
// properties  using `process.env.PROP_NAME`

import path from 'path';
import session from 'express-session';
import { LangCode } from '../shared/types/dialogue-types';
import { toBoolean } from '../shared/util/genericUtil';

export default {
  currentGenshinVersion: '3.3',
  database: {
    filename: './genshin_data.db',
    voiceItemsFile: './voiceItemsNormalized.json',
    getTextMapFile: (langCode: LangCode): string => './TextMap/TextMap'+langCode+'.json',
    getGenshinDataFilePath(file: string): string {
      return path.resolve(process.env.GENSHIN_DATA_ROOT, file).replaceAll('\\', '/');
    }
  },
  session: session({
    secret: process.env.SESSID_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: toBoolean(process.env.SSL_ENABLED),
    },
  }),
  csrfConfig: {
    standard: {
      cookie: {
        secure: toBoolean(process.env.SSL_ENABLED),
        httpOnly: true,
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
    },
    api: {
      cookie: {
        secure: toBoolean(process.env.SSL_ENABLED),
        httpOnly: true,
      },
      ignoreMethods: ['HEAD', 'OPTIONS']
    }
  },
  views: {
    root: path.resolve(__dirname, './views'),
    publicDir: path.resolve(__dirname, '../../public'),
    siteTitle: 'Saccharose.wiki',
    ejsDelimiter: '%',
    formatPageTitle:
      (siteTitle, pageTitle) => pageTitle ? `${pageTitle} | ${siteTitle}` : siteTitle,
  },
};
