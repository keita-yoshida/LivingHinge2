/* アプリ全体で共有する型。
   幾何はすべて mm 座標。原点は左上、y は下向き（CLAUDE.md §2）。 */

/** mm 座標の点 */
export type Point = [number, number];

/** 折れ線。カットの唯一の表現 */
export type Polyline = Point[];

export type PatternId =
  | "straight" | "wave" | "diamond" | "cross" | "arc"
  | "hex" | "hexslit" | "bone" | "tri" | "spiral";

export type ParamKey =
  | "pitch" | "cut" | "gap"
  | "dw" | "amp" | "wlen" | "cw" | "bulge"
  | "hr" | "hs" | "rw" | "br"
  | "ts" | "td"
  | "cs" | "sw";

/** パターンパラメータのプール。全パターンで共有する（§7.2 P2-12 で分離予定） */
export type Params = Record<ParamKey, number>;

export type MaterialKind = "mdf" | "ply" | "acr";

/** カットの向き。v=縦カット（左右に曲がる） h=横カット */
export type Dir = "v" | "h";

export type ViewMode = "wood" | "laser";

export type PresetName = "soft" | "std" | "firm";

export interface MatProfile {
  kind: MaterialKind;
  /** 板厚 mm。曲げ半径の目安に反映される */
  thick: number;
}

export interface AppState {
  pattern: PatternId;
  W: number;
  H: number;
  frame: boolean;
  dir: Dir;
  margin: number;
  view: ViewMode;
  mat: MatProfile;
  p: Params;
}

/** スライダー1本分の定義 */
export interface ParamDef {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

/** state 直下のキーを操作するスライダー */
export interface GlobalDef extends ParamDef {
  key: "W" | "H" | "margin";
}

export interface PatternDef {
  id: PatternId;
  name: string;
  params: ParamKey[];
}

/** 生成器に渡す入力。state 全体を渡すが、生成器が見るのは p と一部のフラグだけ */
export type GenInput = AppState;

/** 生成器: 余白を除いた矩形 (x0,y0)-(x1,y1) にカットを敷き詰めて返す */
export type Generator = (
  s: GenInput,
  x0: number, y0: number, x1: number, y1: number,
) => Polyline[];

export interface Warning {
  t: string;
  /** true ならエラー表示 */
  e: boolean;
}
