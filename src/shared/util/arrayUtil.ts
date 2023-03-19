import { isUnset, isEmpty } from './genericUtil';
import { isStringBlank, trim } from './stringUtil';

export type SortComparator<T> = (a: T, b: T) => number;
export type ElementComparator<T> = (arrayElement: T, expectedElement: T) => boolean;

export function toArray<T>(obj: T|T[]): T[] {
    return Array.isArray(obj) ? obj : [obj];
}

export function isIterable(obj: any): obj is IterableIterator<any> {
    if (!obj) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

export function isArrayLike(obj: any): boolean {
  return (
    Array.isArray(obj) ||
    (!!obj &&
      typeof obj === "object" &&
      typeof (obj.length) === "number" &&
      (obj.length === 0 ||
        (obj.length > 0 &&
          (obj.length - 1) in obj)
      )
    )
  );
}

export function filterInPlace<T>(a: T[], condition: (item: T) => boolean, thisArg: any = null): T[] {
    let j = 0;

    a.forEach((e: T, i: number) => {
        if (condition.call(thisArg, e, i, a)) {
            if (i !== j) a[j] = e;
            j++;
        }
    });

    // From: https://stackoverflow.com/a/37319954
    // This is a little weird, but you can actually change the 'length' property of an array
    a.length = j;
    return a;
}

/**
 * Create an object with the given set of keys where each key will have the same value.
 * @param keys
 * @param value
 */
export function fromKeysWithFixedValue<T>(keys: string[], value: T): { [key: string]: T } {
    let obj = {};
    for (let key of keys) {
        obj[key] = value;
    }
    return obj;
}

export function resolveObjectPath(o: any, s: string, deleteMode: boolean = false): any {
    if (typeof s !== 'string') return undefined;
    s = s.replace(/\.?\[([^\]]+)]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    if (isStringBlank(s)) return o;
    let a = s.split('.');
    let lastIdx = a.length - 1;
    for (let i = 0; i < a.length; i++) {
        let k = a[i];
        let isLast = i === lastIdx;
        if (typeof o === 'object' && k in o) {
            let v = o[k];
            if (isLast && deleteMode) {
                delete o[k];
            }
            o = v;
        } else if (Array.isArray(o) && ['#ALL', '#EACH', '#EVERY'].includes(k.toUpperCase())) {
            return o.map(item => resolveObjectPath(item, a.slice(i + 1).join('.'), deleteMode)).flat(Infinity);
        } else {
            return undefined;
        }
    }
    return o;
}

export function groupBy<T>(array: T[], property: string): { [groupedBy: string]: T[] } {
    let grouped = {};
    for (let obj of array) {
        if (!grouped.hasOwnProperty(obj[property])) {
            grouped[obj[property]] = [];
        }
        grouped[obj[property]].push(obj);
    }
    return grouped;
}

export function compare<T>(a: T, b: T, field?: string|SortComparator<T>, nullsLast: boolean = false): number {
    if (isUnset(a) && !isUnset(b)) return nullsLast ? 1 : -1;
    if (!isUnset(a) && isUnset(b)) return nullsLast ? -1 : 1;
    if (isUnset(a) && isUnset(b)) return 0;

    let reverse = false;
    if (typeof field === 'string' && field.startsWith('-')) {
        reverse = true;
        field = field.slice(1);
    }
    if (typeof field === 'string' && field.startsWith('+')) {
        field = field.slice(1);
    }

    let n = 0;

    if (typeof a === 'string' && typeof b === 'string') {
        n = trim(a, `"`).localeCompare(trim(b, `"`));
    } else if (typeof a === 'number' && typeof b === 'number') {
        n = a - b;
    } else if (typeof a === 'object' && typeof b === 'object' && !!field) {
        if (typeof field === 'function') {
            n = field(a, b);
        } else {
            n = compare(resolveObjectPath(a, field), resolveObjectPath(b, field), null, reverse ? !nullsLast : nullsLast);
        }
    } else {
        if (a < b) n = -1;
        if (a > b) n = 1;
    }
    return reverse ? -n : n;
}

/**
 * Sorts an array **in-place**.
 *
 * Standard sort (can sort number/strings):
 * ```
 *   let myArr = [5, -1, 4, 2, 3, 0, 1];
 *   sort(myArr); // => [-1, 0, 1, 2, 3, 4, 5]
 * ```
 *
 * Reverse sort:
 * ```
 *   let myArr = [5, -1, 4, 2, 3, 0, 1];
 *   sort(myArr, '-'); // => [5, 4, 3, 2, 1, 0, -1]
 * ```
 *
 * Sorting on a field:
 * ```
 *   let myArr = [{n: 3}, {n: 1}, {n: 5}, {n: 4}, {n: 2}];
 *   sort(myArr, 'n'); // => [{n: 1}, {n: 2}, {n: 3}, {n: 4}, {n: 5}]
 * ```
 *
 * Sorting on a field (desc):
 * ```
 *   let myArr = [{n: 3}, {n: 1}, {n: 5}, {n: 4}, {n: 2}];
 *   sort(myArr, '-n'); // => [{n: 5}, {n: 4}, {n: 3}, {n: 2}, {n: 1}]
 * ```
 *
 * Reverse sort on nested field:
 * ```
 *   let myArr = [{n: {x: 3}}, {n: {x: 1}}, {n: {x: 5}}, {n: {x: 4}}, {n: {x: 2}}];
 *   sort(myArr, '-n.x'); // => [{n: {x: 5}}, {n: {x: 4}}, {n: {x: 3}}, {n: {x: 2}}, {n: {x: 1}}]
 * ```
 *
 * Sorting on multiple fields (x asc, y asc):
 * ```
 *   let myArr = [{x: 1}, {x: 9}, {x: 2}, {x: 3, y: 20}, {x: 3, y: 10}, {x: 3, y: 10}, {x: 3, y: -30}, {x: -3}];
 *   sort(myArr, 'x', 'y'); // => [{x:-3}, {x:1}, {x:2}, {x:3,y:-30}, {x:3,y:10}, {x:3,y:10}, {x:3,y:20}, {x:9}]
 * ```
 *
 * Sorting on multiple fields (x asc, y desc):
 * ```
 *   let myArr = [{x: 1}, {x: 9}, {x: 2}, {x: 3, y: 20}, {x: 3, y: 10}, {x: 3, y: 10}, {x: 3, y: -30}, {x: -3}];
 *   sort(myArr, 'x', '-y'); // => [{x:-3}, {x:1}, {x:2}, {x:3,y:20}, {x:3,y:10}, {x:3,y:10}, {x:3,y:-30}, {x:9}]
 * ```
 */
export function sort<T>(array: T[], ...fields: (string|SortComparator<T>)[]): T[] {
    if (!Array.isArray(array)) throw new Error('Must be an array!');
    array.sort((a: T, b: T) => {
        if (!fields || !fields.length)
            return compare(a, b, null, true);
        return fields.map(field => compare(a, b, field, true)).find(n => n !== 0) || 0;
    });
    return array;
}

export function cleanEmpty<T>(o: T): T {
    if (isEmpty(o)) {
        return o;
    } else if (Array.isArray(o)) {
        return <T> o.map(item => cleanEmpty(item)).filter(x => !isEmpty(x));
    } else if (typeof o === 'object') {
        let copy = Object.assign({}, o);
        for (let key of Object.keys(copy)) {
            copy[key] = cleanEmpty(copy[key]);
            if (isEmpty(copy[key])) {
                delete copy[key];
            }
        }
        return copy;
    } else {
        return o;
    }
}

export function arrayUnique<T>(a: T[]): T[] {
    let prims = { 'boolean': {}, 'number': {}, 'string': {} }, objs = [];
    return a.filter(function(item) {
        let type = typeof item;
        if (type in prims)
            return prims[type].hasOwnProperty(item) ? false : (prims[type][item] = true);
        else
            return objs.indexOf(item) >= 0 ? false : objs.push(item);
    });
}

export function arrayEmpty(array: any[]) {
    return !array || array.length === 0;
}

export function arrayIndexOf<T>(array: T[], obj: T, comparator?: ElementComparator<T>): number {
    if (!comparator)
        return array.indexOf(obj);
    for (let i = 0; i < array.length; i++) {
        let item = array[i];
        if (item === obj || comparator(item, obj))
            return i;
    }
    return -1;
}

export function arrayContains<T>(array: T[], obj: T, comparator?: ElementComparator<T>): boolean {
    return arrayIndexOf(array, obj, comparator) >= 0;
}

export function arrayIntersect<T>(args: T[][], comparator?: ElementComparator<T>): T[] {
    let result = [];
    let lists: T[][] = args;

    for (let i = 0; i < lists.length; i++) {
        let currentList = lists[i];
        for (let y = 0; y < currentList.length; y++) {
            let currentValue = currentList[y];
            if (!arrayContains(result, currentValue, comparator)) {
                if (lists.filter(list => !arrayContains(list, currentValue, comparator)).length == 0) {
                    result.push(currentValue);
                }
            }
        }
    }
    return result;
}

export function arraySum(array: number[]): number {
    return array.reduce((a: number, b: number) => a + b, 0);
}

export function pairArrays<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  return !arr1 || !Array.isArray(arr1) ? [] : arr1.map((item: T, idx: number) => [item, arr2?.[idx]]);
}

declare global {
  interface Array<T> {
    asyncMap<U>(callbackfn: (value: T, index: number, array: T[]) => Promise<U>, skipNilResults?: boolean): Promise<U[]>;
  }
}

Array.prototype.asyncMap = async function<T, U>(callbackfn: (value: T, index: number, array: T[]) => Promise<U>, skipNilResults: boolean = true): Promise<U[]> {
  let ret: U[] = [];
  for (let i = 0; i < this.length; i++) {
    let fnRet = await callbackfn(this[i], i, this);
    if (skipNilResults && isUnset(fnRet)) {
      continue;
    }
    ret.push(fnRet);
  }
  return ret;
}