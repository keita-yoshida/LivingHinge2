import type { AppState, Dir, MaterialKind, ParamDef, ParamKey, Params, PatternId, PresetName, Polyline, ViewMode } from "../types";
import { state, GLOBAL_DEFS, PARAM_DEFS } from "../state";
import { board } from "../board";
import { GEN, PATTERNS, PRESETS } from "../geometry/patterns";
import { MATERIALS, RADIUS_C, effScore, flexScoreOf, estMinRadius, genPolysFor } from "../material";
import { regenerate } from "../app";
import { fitView, renderView, ptsAttr } from "../render2d";
import { $, $$ } from "../dom";
import { renderStats, updateMinR } from "./stats";
import { renderWarnings } from "./warnings";
import { scheduleHash } from "./hash";
import { toast } from "./toast";

/** bindCtl が同期用のフックを生やす .ctl 要素 */
type CtlEl = HTMLElement & { _sync?: () => void };

export function ctlHTML(def:ParamDef&{key:string},val:number):string{
  return `<div class="ctl" data-key="${def.key}">
    <div class="ctl-head">
      <label>${def.label}${def.hint?`<span class="hint">${def.hint}</span>`:""}</label>
      <span class="valbox"><input type="number" min="${def.min}" max="${def.max}" step="${def.step}" value="${val}"><span class="unit">${def.unit}</span></span>
    </div>
    <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${val}" aria-label="${def.label}">
  </div>`;
}
export function bindCtl(el:CtlEl,get:()=>number,set:(v:number)=>void):void{
  const num=el.querySelector<HTMLInputElement>("input[type=number]");
  const rng=el.querySelector<HTMLInputElement>("input[type=range]");
  const paint=()=>{
    const v=get(),min=+rng.min,max=+rng.max;
    rng.style.setProperty("--fill",((v-min)/(max-min)*100)+"%");
  };
  rng.addEventListener("input",()=>{set(+rng.value);num.value=rng.value;paint();regenerate();});
  num.addEventListener("change",()=>{
    let v=+num.value;
    if(isNaN(v))v=+rng.value;
    v=Math.min(+num.max,Math.max(+num.min,v));
    num.value=String(v);rng.value=String(v);set(v);paint();regenerate();
    if(el.dataset.key==="W"||el.dataset.key==="H")fitView();
  });
  el._sync=()=>{const v=get();num.value=String(v);rng.value=String(v);paint();};
  el._sync();
}

export function buildGlobalCtls(){
  const host=$("globalCtls");
  host.innerHTML=GLOBAL_DEFS.map(d=>ctlHTML(d,state[d.key])).join("");
  GLOBAL_DEFS.forEach(d=>{
    const el=host.querySelector<CtlEl>(`.ctl[data-key="${d.key}"]`);
    bindCtl(el,()=>state[d.key],v=>{state[d.key]=v;});
  });
}
export function buildParamCtls(){
  const host=$("paramCtls");
  const pat=PATTERNS.find(p=>p.id===state.pattern);
  host.innerHTML=pat.params.map(k=>ctlHTML({key:k,...PARAM_DEFS[k]},state.p[k])).join("");
  pat.params.forEach(k=>{
    const el=host.querySelector<CtlEl>(`.ctl[data-key="${k}"]`);
    bindCtl(el,()=>state.p[k],v=>{state.p[k]=v;});
  });
}
/* pattern cards with live thumbnails */
function thumbSVG(id:PatternId):string{
  const th:AppState={pattern:id,W:66,H:44,frame:false,dir:"v",margin:2,view:"laser",mat:state.mat,
    p:{pitch:8,cut:12,gap:2,dw:3,amp:2,wlen:12,cw:4,bulge:2.4,hr:6,hs:1.6,rw:1.3,br:1.6,ts:19,td:1.1,cs:15,sw:2.2}};
  const polys=GEN[id](th,2,2,64,42);
  const s=polys.map((p:Polyline)=>p.length===2
    ?`<line x1="${p[0][0].toFixed(2)}" y1="${p[0][1].toFixed(2)}" x2="${p[1][0].toFixed(2)}" y2="${p[1][1].toFixed(2)}"/>`
    :`<polyline points="${ptsAttr(p)}"/>`).join("");
  return `<svg viewBox="0 0 66 44" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round">${s}</svg>`;
}
export function buildPatternCards(){
  const host=$("patternCards");
  host.innerHTML=PATTERNS.map(p=>
    `<button class="pat${p.id===state.pattern?" on":""}" data-id="${p.id}" role="radio" aria-checked="${p.id===state.pattern}">
      ${thumbSVG(p.id)}<span>${p.name}</span></button>`).join("");
  host.querySelectorAll<HTMLElement>(".pat").forEach(b=>{
    b.onclick=()=>{
      state.pattern=b.dataset.id as PatternId;
      host.querySelectorAll<HTMLElement>(".pat").forEach(x=>{
        const on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-checked",String(on));
      });
      buildParamCtls();
      regenerate();
    };
  });
}

/* presets */
$$(".preset").forEach(b=>{
  b.onclick=()=>{
    Object.assign(state.p,PRESETS[b.dataset.preset as PresetName]);
    buildParamCtls();
    regenerate();
    toast(`プリセット「${b.dataset.name}」を適用しました`);
  };
});

/* material / thickness / target radius */
export const matThickNum=$<HTMLInputElement>("matThickNum");
export const matThickRng=$<HTMLInputElement>("matThickRng");
export function setThickness(v:number):void{
  v=Math.min(10,Math.max(1,Math.round(v*2)/2));
  state.mat.thick=v;
  matThickNum.value=String(v);matThickRng.value=String(v);
  matThickRng.style.setProperty("--fill",((v-1)/9*100)+"%");
  updateMinR();renderWarnings();scheduleHash();
}
matThickRng.addEventListener("input",()=>setThickness(+matThickRng.value));
matThickNum.addEventListener("change",()=>{
  const v=+matThickNum.value;
  setThickness(isNaN(v)?state.mat.thick:v);
});
$$("#segMat button").forEach(b=>{
  b.onclick=()=>{
    state.mat.kind=b.dataset.mat as MaterialKind;
    $$("#segMat button").forEach(x=>x.classList.toggle("on",x===b));
    updateMinR();renderWarnings();scheduleHash();
  };
});
/* target radius solver: bisect between a firm and a soft parameter set,
   scoring with the real generator, so it stays consistent with the gauge */
$("btnSolve").onclick=()=>{
  const R=+$<HTMLInputElement>("targetR").value;
  if(isNaN(R)||R<5||R>500){toast("目標半径は5〜500mmの範囲で指定してください");return;}
  const need=RADIUS_C*MATERIALS[state.mat.kind].k*state.mat.thick/R;
  const genH=(state.dir==="v"?state.H:state.W)-2*state.margin;
  const pat=state.pattern;
  let hard:Partial<Params>,soft:Partial<Params>;
  if(pat==="hex"){hard={hr:8,hs:2.6,gap:3};soft={hr:3.5,hs:0.6,gap:1};}
  else if(pat==="hexslit"){hard={hr:9,hs:3,gap:3};soft={hr:4,hs:0.8,gap:1};}
  else if(pat==="tri"){hard={ts:28,td:2.4,gap:3};soft={ts:12,td:0.7,gap:1};}
  else if(pat==="spiral"){hard={sw:Math.min(2.6,state.p.cs/4.5)};soft={sw:1};} // セルサイズは維持しアーム幅のみ調整
  else if(pat==="bone"){hard={pitch:12,cut:8,gap:4,br:1};soft={pitch:3,cut:Math.max(14,Math.min(60,genH*0.5)),gap:1,br:1.4};}
  else{hard={pitch:12,cut:8,gap:4};soft={pitch:3,cut:Math.max(14,Math.min(60,genH*0.5)),gap:1};}
  const mix=(u:number):Params=>{const o={...state.p};for(const k of Object.keys(hard) as ParamKey[])o[k]=hard[k]!+(soft[k]!-hard[k]!)*u;return o;};
  const sc=(u:number):number=>{const p=mix(u);return effScore(flexScoreOf(genPolysFor(p),p,pat));};
  let u:number,clamped:"firm"|"soft"|null=null;
  if(need<=sc(0)){u=0;clamped="firm";}
  else if(need>=sc(1)){u=1;clamped="soft";}
  else{
    let lo=0,hi=1;
    for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(sc(mid)<need)lo=mid;else hi=mid;}
    u=(lo+hi)/2;
  }
  const res=mix(u);
  for(const k of Object.keys(hard) as ParamKey[]){
    const d=PARAM_DEFS[k];
    res[k]=+Math.min(d.max,Math.max(d.min,Math.round(res[k]/d.step)*d.step)).toFixed(3);
  }
  Object.assign(state.p,res);
  buildParamCtls();
  regenerate();
  const est=estMinRadius(flexScoreOf(board.cuts,state.p,pat));
  const estTxt=est>500?"500以上":String(Math.round(est));
  if(clamped==="soft")toast(`このパターン・サイズでは目標に届きません。最も柔らかい設定を適用しました（目安 R≈${estTxt}mm）`);
  else if(clamped==="firm")toast(`最もかたい設定でも目標を満たせます（目安 R≈${estTxt}mm）`);
  else toast(`目標半径 ${R}mm に合わせて調整しました（目安 R≈${estTxt}mm）`);
};

$("selSpeed").onchange=()=>{renderStats();renderWarnings();};

/* frame / direction / view */
$<HTMLInputElement>("chkFrame").onchange=e=>{state.frame=(e.target as HTMLInputElement).checked;regenerate();};
$$("#segDir button").forEach(b=>{
  b.onclick=()=>{
    state.dir=b.dataset.dir as Dir;
    $$("#segDir button").forEach(x=>x.classList.toggle("on",x===b));
    regenerate();
  };
});
$$("#segView button").forEach(b=>{
  b.onclick=()=>{
    state.view=b.dataset.view as ViewMode;
    $$("#segView button").forEach(x=>x.classList.toggle("on",x===b));
    renderView();
  };
});
