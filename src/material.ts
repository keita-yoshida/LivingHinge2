import type { MaterialKind, Params, PatternId, Polyline } from "./types";
import { state } from "./state";
import { GEN } from "./geometry/patterns";
import { polyLen } from "./geometry/util";

export const MATERIALS: Record<MaterialKind,{name:string;k:number}>={
  mdf:{name:"MDF",       k:1.0},
  ply:{name:"シナベニヤ", k:0.85},
  acr:{name:"アクリル",   k:1.7},
};
// R_min ≈ RADIUS_C × 素材係数 × 板厚 / 柔軟性スコア（ヒューリスティック。§7参照）
// 高スコア域は膝付き圧縮で飽和させる（メアンダー等の極端なカット密度で目安が非現実的になるのを防ぐ）
export const RADIUS_C=9, SCORE_KNEE=1.5, SCORE_KSLOPE=0.4;
export const effScore=(s:number):number=>s<=SCORE_KNEE?s:SCORE_KNEE+(s-SCORE_KNEE)*SCORE_KSLOPE;
export function flexScoreOf(polys:Polyline[],pobj:Params,pattern:PatternId):number{
  const cutLen=polys.reduce((a:number,p:Polyline)=>a+polyLen(p),0);
  const density=cutLen/Math.max(1,state.W*state.H);
  const charLen=(pattern==="hex"||pattern==="hexslit")?pobj.hr*2
    :pattern==="tri"?pobj.ts
    :pattern==="spiral"?pobj.cs*pobj.cs/Math.max(1,pobj.sw)/2
    :pobj.cut;
  return density*Math.sqrt(Math.max(1,charLen));
}
export function estMinRadius(score:number):number{
  return RADIUS_C*MATERIALS[state.mat.kind].k*state.mat.thick/Math.max(0.05,effScore(score));
}
/* generate polylines for arbitrary params without touching global state (pre-transpose coords) */

export function genPolysFor(pobj:Params):Polyline[]{
  const m=state.margin;
  const genW=state.dir==="v"?state.W:state.H;
  const genH=state.dir==="v"?state.H:state.W;
  const x0=m, y0=m, x1=genW-m, y1=genH-m;
  if(x1-x0<=2||y1-y0<=2)return [];
  return GEN[state.pattern]({...state,p:pobj},x0,y0,x1,y1);
}
