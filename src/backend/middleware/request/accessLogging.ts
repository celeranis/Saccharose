import morgan from 'morgan';

import { DEFAULT_LANG } from '../../../shared/types/lang-types.ts';
import { DEFAULT_SEARCH_MODE } from '../../../shared/util/searchUtil.ts';
import { Request, Response } from 'express';

const logSkipRegex: RegExp = /\.css|\.js|\.png|\.svg|\.ico|\.jpg|\.woff|\.env|serve-image/g;

morgan.token('date', function(){
  return new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
});

morgan.token('url', (req: Request) => decodeURI(req.originalUrl || req.url));
morgan.token('inputLanguage', (req: Request) => req.cookies['inputLangCode'] || DEFAULT_LANG);
morgan.token('outputLanguage', (req: Request) => req.cookies['outputLangCode'] || DEFAULT_LANG);
morgan.token('searchMode', (req: Request) => req.cookies['search-mode'] || DEFAULT_SEARCH_MODE);
morgan.token('siteUser', (req: Request) => {
  if (req.isAuthenticated()) {
    return '@' + (req.user.discord_username || '-') + ':' +(req.user.wiki_username || '-');
  } else {
    return 'guest';
  }
});

export default morgan('[:date[web] PST] [:siteUser] [:inputLanguage::outputLanguage|:searchMode] :status :method :url (:response-time ms)', {
  skip: function(req: Request, res: Response) {
    return res.statusCode === 304 || logSkipRegex.test(req.url);
  }
});
