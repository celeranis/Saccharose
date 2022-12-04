import { MwComment, MwNowiki } from '../mwTypes';
import { MwParseModule } from '../mwParseModule';

export class MwParseHtmlModule extends MwParseModule {
  offer(ch: string): boolean {
    const ctx = this.ctx;
    if (ch === '<') {
      if (ctx.iter.peek(4) === '<!--') {
        let match = /^(<!--)(.*?)(-->)/si.exec(ctx.iter.peek());
        if (match) {
          ctx.addNode(new MwComment(match[1], match[2], match[3]));
          ctx.iter.skip(match[0].length);
          return true;
        }
      }
      if (ctx.iter.peek(8) === '<nowiki>') { // TODO self closing (must have "/")
        let match = /^(<nowiki>)(.*?)(<\/nowiki>)/si.exec(ctx.iter.peek());
        if (match) {
          ctx.addNode(new MwNowiki(match[1], match[2], match[3]));
          ctx.iter.skip(match[0].length);
          return true;
        }
      }
    }
    return false;
  }
}