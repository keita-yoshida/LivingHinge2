import type { Point, Polyline } from "./types";
import { state } from "./state";
import { board } from "./board";
import { $ } from "./dom";

export const pv=$<HTMLElement>("pv");
export const gBoard=$("gBoard");
export const gCuts=$("gCuts");
export const gDims=$("gDims");
export const viewport=$("viewport");
export let view={x:0,y:0,w:100,h:100};
export let fitScaleW=100;

export function setViewBox(){
  pv.setAttribute("viewBox",`${view.x} ${view.y} ${view.w} ${view.h}`);
  $("zoomVal").textContent=Math.round(fitScaleW/view.w*100)+"%";
}
export function fitView(){
  const pad=Math.max(state.W,state.H)*0.14+8;
  const vw=viewport.clientWidth||800, vh=viewport.clientHeight||500;
  const ar=vw/vh;
  let w=state.W+pad*2, h=state.H+pad*2;
  if(w/h<ar) w=h*ar; else h=w/ar;
  view={x:(state.W-w)/2, y:(state.H-h)/2, w, h};
  fitScaleW=w;
  setViewBox();
}

export function esc(str:string):string{return str.replace(/&/g,"&amp;").replace(/</g,"&lt;");}
export function ptsAttr(poly:Polyline):string{return poly.map((p:Point)=>p[0].toFixed(3)+","+p[1].toFixed(3)).join(" ");}

export function renderPreview(){
  const laser=state.view==="laser";
  const W=state.W,H=state.H;
  const sw=Math.min(0.6,Math.max(0.15,Math.max(W,H)/350));
  // board
  let b="";
  if(laser){
    b=`<rect x="0" y="0" width="${W}" height="${H}" rx="0.8" fill="#0c0e12" stroke="#39404d" stroke-width="${sw*0.7}"/>`;
  }else{
    b=`<rect x="0" y="0" width="${W}" height="${H}" rx="0.8" fill="url(#wood)" filter="url(#boardShadow)"/>`+
      `<rect x="0" y="0" width="${W}" height="${H}" rx="0.8" fill="#c99a5b" filter="url(#grain)"/>`;
  }
  gBoard.innerHTML=b;
  // board.cuts
  const col=laser?"#3fd7ff":"#33220e";
  gCuts.setAttribute("stroke",col);
  gCuts.setAttribute("stroke-width",String(laser?sw*0.8:sw));
  let s="";
  for(const p of board.cuts){
    if(p.length===2){
      s+=`<line x1="${p[0][0].toFixed(3)}" y1="${p[0][1].toFixed(3)}" x2="${p[1][0].toFixed(3)}" y2="${p[1][1].toFixed(3)}"/>`;
    }else{
      s+=`<polyline points="${ptsAttr(p)}"/>`;
    }
  }
  if(board.framePoly&&laser){
    s+=`<polyline points="${ptsAttr(board.framePoly)}" stroke="#ff6b35"/>`;
  }
  gCuts.innerHTML=s;
  // dimensions
  const fs=Math.max(W,H)*0.045, off=fs*1.1, tick=fs*0.4, dimc="#78818d";
  gDims.innerHTML=
    `<g stroke="${dimc}" stroke-width="${sw*0.5}" fill="none">
      <line x1="0" y1="${H+off}" x2="${W}" y2="${H+off}"/>
      <line x1="0" y1="${H+off-tick}" x2="0" y2="${H+off+tick}"/>
      <line x1="${W}" y1="${H+off-tick}" x2="${W}" y2="${H+off+tick}"/>
      <line x1="${W+off}" y1="0" x2="${W+off}" y2="${H}"/>
      <line x1="${W+off-tick}" y1="0" x2="${W+off+tick}" y2="0"/>
      <line x1="${W+off-tick}" y1="${H}" x2="${W+off+tick}" y2="${H}"/>
    </g>
    <text x="${W/2}" y="${H+off+fs*1.3}" fill="${dimc}" font-size="${fs}" text-anchor="middle" font-family="ui-monospace,monospace">${W} mm</text>
    <text x="${W+off+fs*0.5}" y="${H/2}" fill="${dimc}" font-size="${fs}" text-anchor="middle" font-family="ui-monospace,monospace" transform="rotate(90 ${W+off+fs*0.5} ${H/2})">${H} mm</text>`;
  setViewBox();
}

export function renderView(){
  renderPreview();
}

/* zoom & pan */
export function zoomAt(factor:number,cx:number,cy:number):void{
  const nw=view.w*factor;
  if(fitScaleW/nw>40||fitScaleW/nw<0.15)return;
  view.x=cx-(cx-view.x)*factor;
  view.y=cy-(cy-view.y)*factor;
  view.w*=factor; view.h*=factor;
  setViewBox();
}
viewport.addEventListener("wheel",e=>{
  e.preventDefault();
  const r=viewport.getBoundingClientRect();
  const cx=view.x+(e.clientX-r.left)/r.width*view.w;
  const cy=view.y+(e.clientY-r.top)/r.height*view.h;
  zoomAt(Math.pow(1.0015,e.deltaY),cx,cy);
},{passive:false});
let drag: {x:number;y:number;vx:number;vy:number} | null = null;
const touches=new Map<number,{x:number;y:number}>();
let pinchDist=0;
/* NOTE: viewport は setPointerCapture でポインタを占有するため、
   viewport 内にインタラクティブ要素を置く場合は必ず除外処理が要る（CLAUDE.md §5）。
   現在 viewport の中身はプレビュー用 SVG だけなので除外リストは無い。 */
viewport.addEventListener("pointerdown",e=>{
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2){
    const [a,b]=[...touches.values()];
    pinchDist=Math.hypot(b.x-a.x,b.y-a.y);
    drag=null;
  }else{
    drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
  }
  viewport.classList.add("dragging");
  viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener("pointermove",e=>{
  if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const r=viewport.getBoundingClientRect();
  if(touches.size===2){
    const [a,b]=[...touches.values()];
    const d=Math.hypot(b.x-a.x,b.y-a.y);
    if(pinchDist>0&&d>0){
      const cx=view.x+((a.x+b.x)/2-r.left)/r.width*view.w;
      const cy=view.y+((a.y+b.y)/2-r.top)/r.height*view.h;
      zoomAt(pinchDist/d,cx,cy);
    }
    pinchDist=d;
    return;
  }
  if(!drag)return;
  view.x=drag.vx-(e.clientX-drag.x)*view.w/r.width;
  view.y=drag.vy-(e.clientY-drag.y)*view.h/r.height;
  setViewBox();
});
const endPointer=(e:PointerEvent)=>{
  touches.delete(e.pointerId);
  drag=null;pinchDist=0;
  if(touches.size===0)viewport.classList.remove("dragging");
};
viewport.addEventListener("pointerup",endPointer);
viewport.addEventListener("pointercancel",endPointer);
viewport.addEventListener("dblclick",()=>fitView());
$("zoomIn").onclick=()=>zoomAt(1/1.25,view.x+view.w/2,view.y+view.h/2);
$("zoomOut").onclick=()=>zoomAt(1.25,view.x+view.w/2,view.y+view.h/2);
$("btnFit").onclick=()=>fitView();
window.addEventListener("resize",()=>fitView());
