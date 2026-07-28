import { state } from "../state";
import { board } from "../board";
import { flexScoreOf, estMinRadius } from "../material";
import { polyLen } from "../geometry/util";
import { $, $$ } from "../dom";

export function fmtDuration(sec:number):string{
  if(sec<60)return Math.round(sec)+"秒";
  const m=Math.round(sec/60);
  return m<60?m+"分":Math.floor(m/60)+"時間"+(m%60?(m%60)+"分":"");
}
export function renderStats(){
  const n=board.cuts.length+(board.framePoly?1:0);
  let len=board.cuts.reduce((a,p)=>a+polyLen(p),0)+(board.framePoly?polyLen(board.framePoly):0);
  board.totalCutLen=len;
  $("stCount").textContent=String(n);
  $("stLen").textContent=len<10000?String(Math.round(len)):(len/1000).toFixed(1)+"k";
  $("stSize").textContent=`${state.W}×${state.H}`;
  $("stTime").textContent=
    len>0?fmtDuration(len/(+$<HTMLSelectElement>("selSpeed").value)):"-";
  // flexibility heuristic
  const score=flexScoreOf(board.cuts,state.p,state.pattern);
  let lvl:number,label:string;
  if(score<0.25){lvl=1;label="かたい";}
  else if(score<0.45){lvl=2;label="やや硬め";}
  else if(score<0.7){lvl=3;label="標準";}
  else if(score<1.05){lvl=4;label="柔らかめ";}
  else{lvl=5;label="とても柔らか";}
  $$("#flexDots i").forEach((d,i)=>d.classList.toggle("on",i<lvl));
  $("flexLabel").textContent=label;
  updateMinR(score);
}
export function updateMinR(score?:number):void{
  const el=$("minR");
  if(!board.cuts.length){el.textContent="-";return;}
  if(score===undefined)score=flexScoreOf(board.cuts,state.p,state.pattern);
  const r=estMinRadius(score);
  el.textContent=r>500?">500":String(Math.round(r));
}
