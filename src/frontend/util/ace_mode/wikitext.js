// noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import { MW_BEHAVIOR_SWITCHES_REGEX } from '../../../shared/mediawiki/parseModules/mwParse.specialText';

ace.define('ace/mode/wikitext_highlight_rules', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/lib/lang', 'ace/mode/text_highlight_rules', 'ace/mode/javascript_highlight_rules', 'ace/mode/xml_highlight_rules', 'ace/mode/html_highlight_rules', 'ace/mode/css_highlight_rules'], function(acequire, exports, module) {
  'use strict';

  let oop = acequire('../lib/oop');
  let lang = acequire('../lib/lang');
  let TextHighlightRules = acequire('./text_highlight_rules').TextHighlightRules;
  let JavaScriptHighlightRules = acequire('./javascript_highlight_rules').JavaScriptHighlightRules;
  let XmlHighlightRules = acequire('./xml_highlight_rules').XmlHighlightRules;
  let HtmlHighlightRules = acequire('./html_highlight_rules').HtmlHighlightRules;
  let CssHighlightRules = acequire('./css_highlight_rules').CssHighlightRules;

  let escaped = function(ch) {
    return '(?:[^' + lang.escapeRegExp(ch) + '\\\\]|\\\\.)*';
  };

  let WikitextHighlightRules = function() {
    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used

    HtmlHighlightRules.call(this);

    this.$rules['start'].unshift(
      {
        regex: new RegExp(`(?:${MW_BEHAVIOR_SWITCHES_REGEX()})`),
        token: 'wikitext.behavior-switch'
      },
      {
        token: function(value) {
          return 'wikitext.header.header-open.' + value.length;
        },
        regex: /^(={1,6})(?=.*?\1\s*$)/,
        next: 'wt_header',
        onMatch: function(val, state, stack) {
          stack.unshift('wt_header');
          return 'wikitext.header.header-open';
        }
      },
      {
        token: 'wikitext.variable.variable-open',
        regex: /{{{/,
        next: 'wt_variable',
        onMatch: function(val, state, stack) {
          stack.unshift('wt_variable');
          return 'wikitext.variable.variable-open.variable-color';
        }
      },
      {
        token: 'wikitext.template.template-open',
        regex: /{{/,
        next: 'wt_template',
        onMatch: function(val, currentState, stack) {
          stack.unshift('wt_template');
          return 'wikitext.template.template-open.template-color';
        }
      },
      {
        token: 'wikitext.link.link-open',
        regex: /\[\[/,
        next: 'wt_link',
        onMatch: function(val, currentState, stack) {
          stack.unshift('wt_template');
          return 'wikitext.link.link-open.link-color';
        }
      },
      { include: 'wt_textstyle' },
      {
        token: 'wikitext.nowiki.nowiki-open',
        regex: /<nowiki[^>]*>/,
        next: 'wt_nowiki',
      },
      {
        token: 'wikitext.pre.pre-open',
        regex: /<pre[^>]*>/,
        next: 'wt_pre',
      }
    );

    function stack_tokens(initialToken, stack, exclude = []) {
      if (typeof exclude === 'string') {
        exclude = exclude.split('.');
      }
      let res = [ ... initialToken.split('.') ];
      for (let s of stack) {
        let include = false;
        if (s.startsWith('wt_')) {
          s = s.slice(3);
          include = true;
        }
        if (include && !res.includes(s) && !exclude.includes(s)) {
          res.push(s);
        }
      }
      if (!res.some(x => x.includes('-color'))) {
        for (let s of stack) {
          if (s === 'wt_variable') {
            res.push('variable-color');
            break;
          } else if (s === 'wt_template') {
            res.push('template-color');
            break;
          } else if (s === 'wt_link') {
            res.push('link-color');
            break;
          }
        }
      }
      return res.join('.');
    }

    this.addRules({
      wt_textstyle: [
        { include: 'wt_bold_open' },
        { include: 'wt_italic_open' },
      ],
      wt_bold_open: [
        {
          regex: /([']{3})(?=.*?'*\1)/,
          next: 'wt_bold',
          onMatch: function(val, currentState, stack) {
            stack.unshift('wt_bold');
            return 'wikitext.bold.bold-open';
          }
        },
      ],
      wt_italic_open: [
        {
          regex: /([']{2})(?=.*?'*\1)/,
          next: 'wt_italic',
          onMatch: function(val, currentState, stack) {
            stack.unshift('wt_italic');
            return 'wikitext.italic.italic-open';
          }
        },
      ],
      wt_header: [
        {
          token: function(value) {
            return 'wikitext.header.header-close.' + value.length;
          },
          regex: /={1,6}\s*$/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.header.header-close';
          }
        },
        { include: 'wt_textstyle' },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext.header.header-text', stack);
          }
        }
      ],
      wt_template: [
        {
          token: 'wikitext.template.template-close.template-color',
          regex: /}}/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.template.template-close.template-color';
          }
        },
        { include: 'start' },
        {
          token: 'wikitext.template.template-color.template-customVar',
          regex: /\{\s*[^\s{}]+\s*}/,
        },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext.template.template-text.template-color', stack, 'variable-color');
          }
        }
      ],
      wt_variable: [
        {
          token: 'wikitext.variable.variable-close.variable-color',
          regex: /}}}/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.variable.variable-close.variable-color';
          }
        },
        { include: 'start' },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext.variable.variable-text.variable-color', stack, 'template-color');
          }
        }
      ],
      wt_link: [
        {
          token: 'wikitext.link.link-close.link-color',
          regex: /]]/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.link.link-close.link-color';
          }
        },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext.link.link-text.link-color', stack);
          }
        }
      ],
      wt_italic: [
        { include: 'wt_bold_open' },
        {
          regex: /''/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.italic.italic-close';
          }
        },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext', stack);
          }
        }
      ],
      wt_bold: [
        {
          regex: /'''/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.bold.bold-close';
          }
        },
        { include: 'wt_italic_open' },
        {
          defaultToken: function(currentState, stack) {
            return stack_tokens('wikitext', stack);
          }
        }
      ],
      wt_nowiki: [
        {
          regex: /<\/nowiki\s*>/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.nowiki.nowiki-close';
          }
        },
        { defaultToken: 'wikitext.nowiki.nowiki-text' }
      ],
      wt_pre: [
        {
          regex: /<\/pre\s*>/,
          next: 'start',
          onMatch: function(value, currentState, stack) {
            stack.shift();
            this.next = stack[0] || 'start';
            return 'wikitext.pre.pre-close';
          }
        },
        { defaultToken: 'wikitext.pre.pre-text' }
      ],
    });

    this.embedRules(JavaScriptHighlightRules, 'jscode-', [{
      token: 'support.function',
      regex: '^\\s*```',
      next: 'pop',
    }]);

    this.embedRules(HtmlHighlightRules, 'htmlcode-', [{
      token: 'support.function',
      regex: '^\\s*```',
      next: 'pop',
    }]);

    this.embedRules(CssHighlightRules, 'csscode-', [{
      token: 'support.function',
      regex: '^\\s*```',
      next: 'pop',
    }]);

    this.embedRules(XmlHighlightRules, 'xmlcode-', [{
      token: 'support.function',
      regex: '^\\s*```',
      next: 'pop',
    }]);

    console.log('Wikitext Rules:', this.$rules);


    this.normalizeRules();
  };

  WikitextHighlightRules.metaData = {
    '$schema': 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'Wikitext',
    scopeName: 'source.wikitext',
  };

  oop.inherits(WikitextHighlightRules, TextHighlightRules);

  exports.WikitextHighlightRules = WikitextHighlightRules;
});

ace.define('ace/mode/wikitext', ['require', 'exports', 'module', 'ace/lib/oop', 'ace/tokenizer',
  'ace/mode/text', 'ace/mode/javascript',  'ace/mode/xml', 'ace/mode/html', 'ace/mode/wikitext_highlight_rules'], function(acequire, exports, module) {

  'use strict';

  let oop = acequire('../lib/oop');
  let TextMode = acequire('./text').Mode;
  let JavaScriptMode = acequire('./javascript').Mode;
  let XmlMode = acequire('./xml').Mode;
  let HtmlMode = acequire('./html').Mode;
  let Tokenizer = acequire("../tokenizer").Tokenizer;

  let WikitextHighlightRules = acequire('./wikitext_highlight_rules').WikitextHighlightRules;

  // TODO: pick appropriate fold mode
  // var FoldMode = acequire("./folding/cstyle").FoldMode;

  let Mode = function() {
    this.HighlightRules = WikitextHighlightRules;

    this.createModeDelegates({
      'js-': JavaScriptMode,
      'xml-': XmlMode,
      'html-': HtmlMode,
    });

    //this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
  };
  oop.inherits(Mode, TextMode);

  (function() {
    this.type = 'text';
    this.blockComment = { start: '<!--', end: '-->' };

    function splitNotInParens(s, del) {
      var current = '';
      var parenthesis = 0;
      let res = [];
      for (var i = 0, l = s.length; i < l; i++) {
        if (s[i] === '(') {
          parenthesis++;
          current = current + '(';
        } else if (s[i] === ')' && parenthesis > 0) {
          parenthesis--;
          current = current + ')';
        } else if (s[i] === del && parenthesis === 0) {
          res.push(current);
          current = '';
        } else {
          current = current + s[i];
        }
      }
      if (current !== '') {
        res.push(current);
      }
      return res;
    }

    this.getNextLineIndent = function(state, line, tab) {
      return '';
    };

    this.getTokenizer = function() {
      if (!this.$tokenizer) {
        this.$highlightRules = this.$highlightRules || new this.HighlightRules(this.$highlightRuleConfig);
        this.$tokenizer = new Tokenizer(this.$highlightRules.getRules());
        console.log('New Tokenizer', this.$tokenizer);

        let MAX_TOKEN_COUNT = 2000;

        this.$tokenizer.reportError = function reportError(msg, data) {
          var e = new Error(msg);
          e.data = data;
          console.error(msg, data);
          setTimeout(function() { throw e; });
        };

        // Custom implementation of getLineTokens.
        // The entire function is copied from the original except for a few changes.
        this.$tokenizer.getLineTokens = function(line, startState) {
          if (startState && typeof startState != "string") {
            var stack = startState.slice(0);
            startState = stack[0];
            if (startState === "#tmp") {
              stack.shift();
              startState = stack.shift();
            }
          } else
            var stack = [];

          var currentState = startState || "start";
          var state = this.states[currentState];
          if (!state) {
            currentState = "start";
            state = this.states[currentState];
          }
          var mapping = this.matchMappings[currentState];
          var re = this.regExps[currentState];
          re.lastIndex = 0;

          var match, tokens = [];
          var lastIndex = 0;
          var matchAttempts = 0;

          var token = {type: null, value: ""};

          while (match = re.exec(line)) {
            var type = mapping.defaultToken;
            var rule = null;
            var value = match[0];
            var index = re.lastIndex;

            // This if statement was added:
            if (typeof type === 'function') {
              // It allows the "defaultToken" property to also accept a function value
              type = type(currentState, stack, line);
            }

            if (index - value.length > lastIndex) {
              var skipped = line.substring(lastIndex, index - value.length);
              if (token.type === type) {
                token.value += skipped;
              } else {
                if (token.type)
                  tokens.push(token);
                token = {type: type, value: skipped};
              }
            }

            for (var i = 0; i < match.length-2; i++) {
              if (match[i + 1] === undefined)
                continue;

              rule = state[mapping[i]];

              let typeBefore = type;
              let tokenBefore = JSON.parse(JSON.stringify(token));

              if (rule.onMatch)
                type = rule.onMatch(value, currentState, stack, line);
              else
                type = rule.token;

              if (rule.next) {
                if (typeof rule.next == "string") {
                  currentState = rule.next;
                } else {
                  currentState = rule.next(currentState, stack);
                }

                state = this.states[currentState];
                if (!state) {
                  this.reportError("state doesn't exist", currentState);
                  currentState = "start";
                  state = this.states[currentState];
                }
                mapping = this.matchMappings[currentState];
                lastIndex = index;
                re = this.regExps[currentState];
                re.lastIndex = index;
              }
              if (rule.consumeLineEnd)
                lastIndex = index;
              break;
            }

            if (value) {
              if (typeof type === "string") {
                if ((!rule || rule.merge !== false) && token.type === type) {
                  token.value += value;
                } else {
                  if (token.type)
                    tokens.push(token);
                  token = {type: type, value: value};
                }
              } else if (type) {
                if (token.type)
                  tokens.push(token);
                token = {type: null, value: ""};
                for (var j = 0; j < type.length; j++)
                  tokens.push(type[j]);
              }
            }

            if (lastIndex === line.length)
              break;

            lastIndex = index;

            if (matchAttempts++ > MAX_TOKEN_COUNT) {
              if (matchAttempts > 2 * line.length) {
                this.reportError("infinite loop with in ace tokenizer", {
                  startState: startState,
                  line: line
                });
              }
              while (lastIndex < line.length) {
                if (token.type)
                  tokens.push(token);
                token = {
                  value: line.substring(lastIndex, lastIndex += 2000),
                  type: "overflow"
                };
              }
              currentState = "start";
              stack = [];
              break;
            }
          }

          if (token.type)
            tokens.push(token);

          if (stack.length > 1) {
            if (stack[0] !== currentState)
              stack.unshift("#tmp", currentState);
          }
          return {
            tokens : tokens,
            state : stack.length ? stack : currentState
          };
        };
      }
      return this.$tokenizer;
    };

    // this.lineCommentStart = ""//"";
    // this.blockComment = {start: ""/*"", end: ""*/""};
    // Extra logic goes here.

    this.$id = 'ace/mode/wikitext';
  }).call(Mode.prototype);
  exports.Mode = Mode;
});