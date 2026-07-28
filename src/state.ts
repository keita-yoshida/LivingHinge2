import type { AppState, GlobalDef, ParamDef, ParamKey } from "./types";

/* ---------- state ---------- */
export const state: AppState = {
  pattern:"straight",
  W:120, H:70,
  frame:true,
  dir:"v",            // v=縦カット(左右に曲がる) h=横カット
  margin:0,
  view:"wood",
  mat:{kind:"mdf",thick:3},   // material profile (thick drives the bend-radius estimate)
  p:{                 // pattern params (all patterns share the pool)
    pitch:6, cut:20, gap:2,
    dw:2,             // diamond width
    amp:1.6, wlen:18, // wave
    cw:3.5,           // cross horizontal length
    bulge:2,          // arc
    hr:5, hs:1.4,     // hex radius / spacing
    rw:1.2,           // hexslit ring width
    br:1.6,           // bone lens half-width
    ts:18, td:1.0,    // tri cell size / ring spacing
    cs:10, sw:1.4     // meander cell / arm width
  }
};

/* ---------- param definitions ---------- */
export const GLOBAL_DEFS: GlobalDef[] = [
  {key:"W",   label:"全体の幅",   hint:"", min:20, max:800, step:1,  unit:"mm"},
  {key:"H",   label:"全体の高さ", hint:"", min:20, max:800, step:1,  unit:"mm"},
  {key:"margin", label:"余白", hint:"カットしないフチ", min:0, max:30, step:0.5, unit:"mm"},
];
export const PARAM_DEFS: Record<ParamKey, ParamDef> = {
  pitch:{label:"列の間隔",  hint:"狭いほど柔らかい", min:2,   max:24, step:0.5, unit:"mm"},
  cut:  {label:"カット長",  hint:"長いほど柔らかい", min:4,   max:120,step:1,   unit:"mm"},
  gap:  {label:"ブリッジ幅",hint:"つなぎの太さ",     min:0.5, max:12, step:0.1, unit:"mm"},
  dw:   {label:"ひし形の幅",hint:"",                min:0.5, max:12, step:0.1, unit:"mm"},
  amp:  {label:"波の振幅",  hint:"",                min:0.3, max:8,  step:0.1, unit:"mm"},
  wlen: {label:"波長",      hint:"",                min:5,   max:80, step:1,   unit:"mm"},
  cw:   {label:"横カット長",hint:"十字の横棒",       min:1,   max:18, step:0.5, unit:"mm"},
  bulge:{label:"ふくらみ",  hint:"弧の深さ",         min:0.3, max:8,  step:0.1, unit:"mm"},
  hr:   {label:"六角形サイズ",hint:"",              min:2,   max:24, step:0.5, unit:"mm"},
  hs:   {label:"セル間隔",  hint:"六角形どうしの距離",min:0.4, max:8,  step:0.1, unit:"mm"},
  rw:   {label:"リング幅",  hint:"六角形の輪の太さ",  min:0.6, max:6,  step:0.1, unit:"mm"},
  br:   {label:"ふくらみ",  hint:"レンズの膨らみ幅",  min:0.4, max:5,  step:0.1, unit:"mm"},
  ts:   {label:"三角形サイズ",hint:"",               min:8,   max:60, step:1,   unit:"mm"},
  td:   {label:"リング間隔",hint:"狭いほど柔らかい",  min:0.6, max:5,  step:0.1, unit:"mm"},
  cs:   {label:"セルサイズ",hint:"渦1個の大きさ",       min:5,   max:40, step:0.5, unit:"mm"},
  sw:   {label:"アーム幅",  hint:"セルの奇数分割に自動調整",min:0.8, max:5,  step:0.1, unit:"mm"},
};
