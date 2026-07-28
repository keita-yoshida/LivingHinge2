import type { MaterialKind, ParamKey, PatternId } from "../types";
import { state } from "../state";
import { GEN } from "../geometry/patterns";
import { MATERIALS } from "../material";
import { $, $$ } from "../dom";
import { toast } from "./toast";

let hashTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleHash(){
  if(hashTimer)clearTimeout(hashTimer);
  hashTimer=setTimeout(()=>{
    try{
      const data={pattern:state.pattern,W:state.W,H:state.H,frame:state.frame,dir:state.dir,margin:state.margin,mat:state.mat,p:state.p};
      history.replaceState(null,"","#"+encodeURIComponent(JSON.stringify(data)));
    }catch(e){}
  },400);
}
export function loadHash(){
  try{
    if(!location.hash||location.hash.length<3)return;
    const d=JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if(d&&GEN[d.pattern as PatternId]){
      state.pattern=d.pattern;
      (["W","H","frame","dir","margin"] as const).forEach(k=>{if(d[k]!==undefined)(state as any)[k]=d[k];});
      if(d.p)(Object.keys(state.p) as ParamKey[]).forEach(k=>{if(typeof d.p[k]==="number")state.p[k]=d.p[k];});
      if(d.mat&&MATERIALS[d.mat.kind as MaterialKind]){
        state.mat.kind=d.mat.kind;
        if(typeof d.mat.thick==="number")state.mat.thick=Math.min(10,Math.max(1,d.mat.thick));
      }
      $<HTMLInputElement>("chkFrame").checked=state.frame;
      $$("#segDir button").forEach(x=>x.classList.toggle("on",x.dataset.dir===state.dir));
    }
  }catch(e){}
}
$("btnShare").onclick=async()=>{
  scheduleHash();
  setTimeout(async()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      toast("設定を含むURLをコピーしました");
    }catch(e){
      toast("コピーできませんでした。アドレスバーのURLをご利用ください");
    }
  },450);
};
