
// MwNode
//  ├─ MwCharSequence
//  │   ├─ MwBehaviorSwitch
//  │   ├─ MwTextNode
//  │   └─ MwEOL
//  ├─ MwParent
//      ├─ MwTemplateParam
//      ├─ MwTemplateCall
//      ├─ MwElement
//      │   ├─ MwComment
//      │   ├─ MwItalic
//      │   ├─ MwBold
//      │   ├─ MwLink
//      │   ├─ MwHR
//      │   ├─ MwPre
//      │   └─ MwNowiki

import { isInt } from '../util/numberUtil';
import { mwParse, mwSimpleTextParse } from './mwParse';
import { arrayRemove } from '../util/arrayUtil';

export abstract class MwNode {
  abstract toString(): string;
}

/**
 * An MwNode that can contain children.
 */
export class MwParentNode extends MwNode {
  parts: MwNode[] = [];
  override toString(): string {
    return this.parts.map(p => p.toString()).join('');
  }
  addNode(node: MwNode) {
    this.parts.push(node);
  }
  findTemplateNodes(): MwTemplateNode[] {
    let ret: MwTemplateNode[] = [];
    let stack: MwParentNode[] = [this];
    while (stack.length) {
      let node = stack.pop();
      if (node instanceof MwTemplateNode) {
        ret.push(node);
      }
      for (let child of node.parts) {
        if (child instanceof MwParentNode) {
          stack.push(child);
        }
      }
    }
    return ret;
  }
}

// ------------------------------------------------------------------------------------------
export abstract class MwCharSequence extends MwNode {
  content: string;
  protected constructor(content: string) {
    super();
    this.content = content;
  }
  override toString(): string {
    return this.content;
  }
}

export class MwEOL extends MwCharSequence {
  constructor(content: string) {
    super(content);
  }
}
export class MwTextNode extends MwCharSequence {
  constructor(content: string) {
    super(content);
  }
}
export class MwBehaviorSwitch extends MwCharSequence {
  constructor(content: string) {
    super(content);
  }
}
// ------------------------------------------------------------------------------------------
export class MwElement extends MwParentNode {
  tagName: string;
  tagStart: string;
  tagEnd: string;

  constructor(tagName: string, tagStart: string, tagEnd: string) {
    super();
    this.tagName = tagName;
    this.tagStart = tagStart;
    this.tagEnd = tagEnd;
  }

  override toString(): string {
    return this.tagStart + super.toString() + this.tagEnd;
  }
}
export class MwComment extends MwElement {
  content: string;
  constructor(tagStart: string, tagContent: string, tagEnd: string) {
    super('comment', tagStart, tagEnd);
    this.content = tagContent;
  }
  override toString(): string {
    return this.tagStart + this.content + this.tagEnd;
  }
}
export class MwNowiki extends MwElement {
  content: string;
  constructor(tagStart: string, tagContent: string, tagEnd: string) {
    super('nowiki', tagStart, tagEnd);
    this.content = tagContent;
  }
  override toString(): string {
    return this.tagStart + this.content + this.tagEnd;
  }
}
export class MwHeading extends MwElement {
  constructor(tagName: string, tagStart: string, tagEnd: string) {
    super(tagName, tagStart, tagEnd);
  }
  getLevel(): number {
    // tagName is always H1, H2, H3, H4, H5, or H6
    return parseInt(this.tagName.slice(1));
  }
  get innerText(): string {
    return this.parts.map(p => p.toString()).join('');
  }
  set innerText(wikitext: string) {
    this.parts = mwParse(wikitext).parts;
  }
}

export class MwSection extends MwParentNode {
  constructor(readonly level, readonly heading: MwHeading) {
    super();
  }
  override toString(): string {
    return this.heading.toString() + super.toString();
  }
}

export class MwLinkNode extends MwParentNode {
  private _link: string = '';
  linkParts: MwCharSequence[] = [];
  hasParams: boolean = false;
  type: MwLinkType;

  constructor(type: MwLinkType, link: string) {
    super();
    this.type = type;
    this.link = link;
  }

  get link() {
    return this._link;
  }

  set link(newLink: string) {
    this._link = newLink.trim();
    this.linkParts = mwSimpleTextParse(newLink);
  }

  get isInternal(): boolean {
    return this.type === 'InternalLink';
  }

  get isExternal(): boolean {
    return this.type === 'ExternalLink';
  }

  get isFile(): boolean {
    return this.type === 'File';
  }

  override toString(): string {
    if (this.type === 'InternalLink' || this.type === 'File') {
      return '[[' + this.linkParts.map(p => p.toString()).join('') + super.toString() + ']]';
    } else if (this.type === 'ExternalLink') {
      return '[' + this.linkParts.map(p => p.toString()).join('') + super.toString() + ']';
    }
  }
}

export class MwRedirect extends MwParentNode {
  constructor(parts: MwNode[]) {
    super();
    this.parts = parts;
  }
  getLinkNode(): MwLinkNode {
    return this.parts.find(part => part instanceof MwLinkNode) as MwLinkNode;
  }
}

export type MwParamNodePrefixType = '|' | ':' | ' ' | '';

export class MwParamNode extends MwParentNode {

  /**
   * The key of the parameter.
   * Always a number for anonymous parameters
   * Always a string for numbered and named parameters.
   */
  private _key: number|string;

  prefix: MwParamNodePrefixType = '';

  beforeValueWhitespace: MwTextNode = new MwTextNode('');
  afterValueWhitespace: MwTextNode = new MwTextNode('');

  /**
   * Key parts. Only present for numbered/named parameters.
   */
  keyParts: MwCharSequence[] = [];

  constructor(prefix: MwParamNodePrefixType, key: string|number, simpleTextValue?: string) {
    super();
    this.prefix = prefix;
    this.key = key;
    if (!!simpleTextValue) {
      this.parts = mwSimpleTextParse(simpleTextValue);
    }
  }

  get trimmedValue() {
    return this.value.trim();
  }

  get isAnonymous() {
    return typeof this.key === 'number';
  }

  get isNumbered() {
    return !this.isAnonymous && isInt(this.key);
  }

  get isNamed() {
    return !this.isAnonymous && !isInt(this.key);
  }

  get value() {
    return super.toString();
  }

  set value(wikitext: string) {
    this.parts = mwParse(wikitext).parts;
  }

  get key() {
    return this._key;
  }

  set key(newKey: number|string) {
    if (typeof newKey === 'string') {
      this.keyParts = mwSimpleTextParse(newKey);
      this._key = newKey.trim();
    } else {
      this._key = newKey;
    }
  }

  override toString() {
    if (this.isAnonymous) {
      return this.prefix + this.beforeValueWhitespace.toString() + this.value + this.afterValueWhitespace.toString();
    } else {
      return this.prefix + this.keyParts.map(x => x.toString()).join('') + '=' + this.beforeValueWhitespace.toString() + this.value + this.afterValueWhitespace.toString();
    }
  }

  _evaluateAfterValueWhitespace(): this {
    const parts: MwNode[] = this.parts;
    const afterValueWhitespace: MwTextNode = new MwTextNode('');

    while (true) {
      if (!parts.length) {
        break;
      }
      const lastPart = parts[parts.length - 1];
      if (lastPart instanceof MwEOL) {
        afterValueWhitespace.content = lastPart.content + afterValueWhitespace.content;
        parts.pop();
        continue;
      }

      if (!(lastPart instanceof MwTextNode)) {
        break;
      }

      if (!/\s*$/.test(lastPart.content)) {
        break;
      }

      if (/^\s*$/.test(lastPart.content)) {
        afterValueWhitespace.content = lastPart.content + afterValueWhitespace.content;
        parts.pop();
        continue;
      }

      const match = /^(.*?)(\s*)$/.exec(lastPart.content);
      afterValueWhitespace.content = match[2] + afterValueWhitespace.content;
      lastPart.content = match[1];
      break;
    }

    this.afterValueWhitespace = afterValueWhitespace;
    return this;
  }
}

export type MwTemplateType = 'Template' | 'Variable' | 'ParserFunction' | 'TemplateParam';
export type MwLinkType = 'InternalLink' | 'ExternalLink' | 'File';
export type MwParamParentType = MwTemplateType | MwLinkType;

export class MwTemplateNode extends MwParentNode {
  templateName: string;
  override parts: MwNode[] = [];
  type: MwTemplateType = 'Template';

  constructor(templateName: string) {
    super();
    this.templateName = templateName;
  }

  override toString(): string {
    if (this.type === 'TemplateParam') {
      return '{{{' + super.toString() + '}}}';
    } else {
      return '{{' + super.toString() + '}}';
    }
  }

  get params(): MwParamNode[] {
    return this.parts.filter(part => part instanceof MwParamNode && part.key !== 0) as MwParamNode[];
  }

  getParam(key: string | number): MwParamNode {
    return this.params.find(param => param.key == key);
  }

  getLongestParamKeyLen(ignoring: string[] = []) {
    return Math.max(... this.params
      .filter(p => typeof p.key === 'string' && !ignoring.includes(p.key))
      .map(p => String(p.key).length)
    );
  }

  readjustPropPad(ignoring: string[] = []) {
    const propPad = this.getLongestParamKeyLen(ignoring) + 2;

    for (let param of this.params.filter(p => typeof p.key === 'string')) {
      param.key = String(param.key).padEnd(propPad, ' ');
    }
  }

  removeParam(key: string | number): MwParamNode {
    let param = this.getParam(key);

    if (param) {
      let index = this.parts.indexOf(param);
      let nextNode = this.parts[index + 1];
      if (nextNode instanceof MwEOL && nextNode.content === '\n') {
        arrayRemove(this.parts, [param, nextNode]);
      } else {
        arrayRemove(this.parts, [param]);
      }
    }

    return param;
  }

  removeParams(keys: (string|number)[]|RegExp) {
    if (keys instanceof RegExp) {
      const regexp: RegExp = keys;
      keys = this.params.filter(p => regexp.test(String(p.key))).map(p => p.key);
    }

    for (let key of keys) {
      this.removeParam(key);
    }
  }
}