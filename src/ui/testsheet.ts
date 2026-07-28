import type { AppState, ParamKey, PatternId, Point, Polyline } from "../types";
import { state, PARAM_DEFS } from "../state";
import { GEN } from "../geometry/patterns";
import { makeDXF } from "../export/dxf";
import { makeSVG } from "../export/svg";
import { toast } from "./toast";

/* ---------- test piece sheet ----------
   Small coupons with one parameter stepped across a range, tiled on one sheet.
   Pieces are identified by edge notches (1..n) because the SVG contract forbids text. */
export const TEST_KEY: Partial<Record<PatternId, ParamKey>>={hex:"hs",hexslit:"hs",tri:"td",spiral:"sw"};   // others: gap
export const TEST={pieceW:70,pieceH:30,gapY:6,grip:8,factors:[0.6,0.8,1.0,1.2,1.4]};
export function testPieceVariants(){
  const key:ParamKey=TEST_KEY[state.pattern]||"gap";
  const d=PARAM_DEFS[key], base=state.p[key];
  const seen=new Set<number>(), vals:number[]=[];
  for(const f of TEST.factors){
    let v=Math.round(base*f/d.step)*d.step;
    v=+Math.min(d.max,Math.max(d.min,v)).toFixed(3);
    if(!seen.has(v)){seen.add(v);vals.push(v);}
  }
  return {key,label:d.label,unit:d.unit,vals};
}
export function buildTestSheet(){
  const {pieceW,pieceH,gapY,grip}=TEST;
  const {key,vals}=testPieceVariants();
  const out:Polyline[]=[];
  vals.forEach((v,i)=>{
    const oy=i*(pieceH+gapY);
    // coupon outline
    out.push([[0,oy],[pieceW,oy],[pieceW,oy+pieceH],[0,oy+pieceH],[0,oy]]);
    // hinge pattern, generated between the two grip zones
    const p={...state.p,[key]:v};
    const s: AppState={...state,W:pieceW,H:pieceH,dir:"v",margin:0,p};
    for(const poly of GEN[state.pattern](s,grip,0,pieceW-grip,pieceH)){
      out.push(poly.map(([x,y]):Point=>[x,y+oy]));
    }
    // index notches in the left grip zone: (i+1) nicks cut in from the bottom edge
    for(let k=0;k<=i;k++){
      const nx=2.5+k*2.5;
      out.push([[nx,oy+pieceH],[nx,oy+pieceH-3]]);
    }
  });
  return {polys:out,W:pieceW,H:vals.length*(pieceH+gapY)-gapY,key,vals};
}
export function downloadTestSheet(fmt:"dxf"|"svg"):void{
  const t=buildTestSheet();
  const nan=t.polys.some(p=>p.some(q=>!isFinite(q[0])||!isFinite(q[1])));
  if(nan||t.polys.length<=t.vals.length){toast("現在の設定ではテストピースを生成できません");return;}
  const name=`hinge_test_${state.pattern}_${t.key}`;
  if(fmt==="dxf")download(name+".dxf",makeDXF(t.polys,t.H),"application/dxf");
  else download(name+".svg",makeSVG(t.polys,t.W,t.H),"image/svg+xml");
  const {label,unit}=testPieceVariants();
  toast(`テストピース${t.vals.length}枚（${label} ${t.vals.join(" / ")}${unit}）を出力しました`);
}

export function download(name:string,text:string,mime:string):void{
  const blob=new Blob([text],{type:mime});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
document.getElementById("btnDxf").onclick=()=>{
  download(`hinge_${state.pattern}_${state.W}x${state.H}.dxf`,makeDXF(),"application/dxf");
  toast("DXFファイルをダウンロードしました");
};
document.getElementById("btnSvg").onclick=()=>{
  download(`hinge_${state.pattern}_${state.W}x${state.H}.svg`,makeSVG(),"image/svg+xml");
  toast("SVGファイルをダウンロードしました");
};
document.getElementById("btnTestDxf").onclick=()=>downloadTestSheet("dxf");
document.getElementById("btnTestSvg").onclick=()=>downloadTestSheet("svg");
export function renderTestNote(){
  const {label,unit,vals}=testPieceVariants();
  document.getElementById("testNote").textContent=
    `${TEST.pieceW}×${TEST.pieceH}mmの小片を${vals.length}枚、${label}を ${vals.join(" / ")}${unit} と振って面付けします。左端の切り込みの本数が番号（1〜${vals.length}）です。`;
}
