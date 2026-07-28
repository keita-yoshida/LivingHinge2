/** 型付きの DOM 取得ヘルパー。
 *  単一ファイル時代は document.getElementById(...) を直接書いていたが、
 *  TS 化にあたり戻り値の型を呼び出し側で指定できるようにした。 */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

export const $$ = <T extends Element = HTMLElement>(sel: string): NodeListOf<T> =>
  document.querySelectorAll<T>(sel);
