import type { Polyline } from "./types";

/** 現在の盤面。描画・統計・書き出しの唯一のソース（CLAUDE.md §2）。
 *  単一ファイル時代はモジュール直下の可変変数だったものを、
 *  モジュール間で共有するために1つのオブジェクトへまとめたもの。 */
export const board = {
  /** 生成されたカット */
  cuts: [] as Polyline[],
  /** 外枠。state.frame が false のときは null */
  framePoly: null as Polyline | null,
  /** 総カット長 mm。renderStats が更新し、警告と加工時間見積りが参照する */
  totalCutLen: 0,
};
