import type { Generator, Params, PatternDef, PatternId, Point, Polyline, PresetName } from "../types";
import { clipRect, columnXs, centerYs, lerpPt } from "./util";

export const GEN: Record<PatternId, Generator> = {

  straight(s,x0,y0,x1,y1){
    const {pitch,cut,gap}=s.p, period=cut+gap, out:Polyline[]=[];
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+(i%2?period/2:0);
      for(const yc of centerYs(y0,y1,period,off)){
        out.push([[x,yc-cut/2],[x,yc+cut/2]]);
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  wave(s,x0,y0,x1,y1){
    const {pitch,cut,gap,amp,wlen}=s.p, period=cut+gap, out:Polyline[]=[];
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+(i%2?period/2:0);
      for(const yc of centerYs(y0,y1,period,off)){
        const a=yc-cut/2,b=yc+cut/2;
        const n=Math.max(8,Math.ceil((b-a)/1.2));
        const pts:Polyline=[];
        for(let j=0;j<=n;j++){
          const y=a+(b-a)*j/n;
          pts.push([x+amp*Math.sin((y-y0)*2*Math.PI/wlen),y]);
        }
        out.push(pts);
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  diamond(s,x0,y0,x1,y1){
    const {pitch,cut,gap,dw}=s.p, period=cut+gap, out:Polyline[]=[];
    const w=Math.min(dw,pitch-0.6);
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+cut/2+(i%2?period/2:0);
      for(const yc of centerYs(y0,y1,period,off)){
        out.push([[x,yc-cut/2],[x+w/2,yc],[x,yc+cut/2],[x-w/2,yc],[x,yc-cut/2]]);
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  cross(s,x0,y0,x1,y1){
    const {pitch,cut,gap,cw}=s.p, period=cut+gap, out:Polyline[]=[];
    const w=Math.min(cw,pitch-0.8);
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+cut/2+(i%2?period/2:0);
      for(const yc of centerYs(y0,y1,period,off)){
        out.push([[x,yc-cut/2],[x,yc+cut/2]]);
        out.push([[x-w/2,yc],[x+w/2,yc]]);
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  arc(s,x0,y0,x1,y1){
    const {pitch,cut,gap,bulge}=s.p, period=cut+gap, out:Polyline[]=[];
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+(i%2?period/2:0);
      const dir=i%2?-1:1;
      for(const yc of centerYs(y0,y1,period,off)){
        const a=yc-cut/2,b=yc+cut/2,cx=x+dir*bulge*2,cy=(a+b)/2;
        const n=14,pts=[];
        for(let j=0;j<=n;j++){
          const t=j/n,u=1-t;
          pts.push([u*u*x+2*u*t*cx+t*t*x, u*u*a+2*u*t*cy+t*t*b] as Point);
        }
        out.push(pts);
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  spiral(s,x0,y0,x1,y1){
    // [4,2] 2D meander pattern (Ivanišević / koFAKTORlab):
    // grid of quads; two interlocked rectangular spirals per quad,
    // anchored at diagonally opposite "tree" corners (checkerboard),
    // same chirality everywhere (90° rotation on alternate quads).
    // Uncut corners (edge-vertices) remain as solid fixed nodes.
    const S=s.p.cs, out:Polyline[]=[];
    // snap arm width to S/N with odd N -> perfectly uniform p-spaced interleave
    let N=Math.round(S/s.p.sw); if(N%2===0)N+=(S/(N+1)>=0.6?1:-1); N=Math.max(5,N);
    const p=S/N;
    if(S<p*4)return out;
    const nx=Math.max(1,Math.floor((x1-x0)/S));
    const ny=Math.max(1,Math.floor((y1-y0)/S));
    const ox=x0+((x1-x0)-nx*S)/2, oy=y0+((y1-y0)-ny*S)/2;
    // base spiral branch A: anchored at (0,0), winding inward, pitch 2p
    // interleaves with its 180°-rotation (anchored at (S,S)) at spacing p
    const A=(()=>{
      const pts:Polyline=[[0,0]];
      let x=0,y=0,k=0;
      const step=()=>{
        let nxp=x,nyp=y;
        const m=Math.floor(k/4);
        switch(k%4){
          case 0: nxp=S-(2*m+1)*p; break;          // right
          case 1: nyp=S-(2*m+1)*p; break;          // up
          case 2: nxp=(2*m+2)*p;   break;          // left
          case 3: nyp=(2*m+2)*p;   break;          // down
        }
        const len=Math.abs(nxp-x)+Math.abs(nyp-y);
        const ok=len>p*0.999;
        if(ok){x=nxp;y=nyp;pts.push([x,y]);}
        return ok;
      };
      while(step()&&k<100)k++;
      return pts;
    })();
    const B:Polyline=A.map(([px,py]):Point=>[S-px,S-py]);          // 180° rotation
    const rot90=([px,py]:Point):Point=>[S-py,px];               // same chirality, other diagonal
    for(let r=0;r<ny;r++){
      for(let c=0;c<nx;c++){
        const qx=ox+c*S, qy=oy+r*S;
        const odd=(r+c)%2===1;
        for(const path of [A,B]){
          const P=odd?path.map(rot90):path;
          out.push(P.map(([px,py]):Point=>[qx+px,qy+py]));
        }
      }
    }
    return clipRect(out,x0,y0,x1,y1);
  },

  hex(s,x0,y0,x1,y1){
    const {hr,hs,gap}=s.p, R=hr, out:Polyline[]=[];
    const colStep=Math.sqrt(3)*R+hs;
    const rowStep=1.5*R+hs*0.87;
    const t=Math.min(0.45,(gap/2)/R); // trim ratio at top/bottom vertices
    const V: Record<"T"|"UR"|"LR"|"B"|"LL"|"UL", Point>={
      T:[0,-R], UR:[Math.sqrt(3)*R/2,-R/2], LR:[Math.sqrt(3)*R/2,R/2],
      B:[0,R],  LL:[-Math.sqrt(3)*R/2,R/2], UL:[-Math.sqrt(3)*R/2,-R/2]
    };
    const rows=Math.ceil((y1-y0)/rowStep)+2;
    for(let r=-1;r<rows;r++){
      const cy=y0+R+r*rowStep;
      const xoff=(r%2!==0)?colStep/2:0;
      const cols=Math.ceil((x1-x0)/colStep)+2;
      for(let c=-1;c<cols;c++){
        const cx=x0+colStep/2+c*colStep+xoff;
        const mv=(p:Point):Point=>[cx+p[0],cy+p[1]];
        // right half: near-top -> UR -> LR -> near-bottom
        out.push([lerpPt(V.T,V.UR,t),V.UR,V.LR,lerpPt(V.B,V.LR,t)].map(mv));
        // left half
        out.push([lerpPt(V.T,V.UL,t),V.UL,V.LL,lerpPt(V.B,V.LL,t)].map(mv));
      }
    }
    return clipRect(out,x0,y0,x1,y1);
  },

  bone(s,x0,y0,x1,y1){
    // fequalsf.com "parametric kerf" #6/#7 (reference DXF motif, W=1.205 H=0.133):
    // closed smooth outline = central lens, thin necks, small round bulb at
    // both ends (stress-relief loops). Staggered columns like `straight`.
    const {pitch,cut,gap}=s.p, period=cut+gap, out:Polyline[]=[];
    const A=Math.min(s.p.br, pitch*0.42, cut*0.11);    // lens half-width (ref: 0.055×len)
    const rb=Math.min(A*0.72, cut/8);                  // bulb radius (ref: ~0.7×lens)
    const nk=Math.max(0.1, A*0.13);                    // neck half-width
    const ease=(a:number,b:number,t:number)=>a+(b-a)*(1-Math.cos(Math.PI*Math.min(1,Math.max(0,t))))/2;
    const half=(t:number)=>{                                    // half-width profile, t in [0,cut]
      const d=Math.min(t,cut-t);
      if(d<=0)return 0;
      if(d<1.8*rb)return Math.sqrt(Math.max(0,rb*rb-(d-rb)*(d-rb)));    // round bulb
      if(d<2.7*rb)return ease(0.6*rb, nk, (d-1.8*rb)/(0.9*rb));         // into neck
      return ease(nk, A, (d-2.7*rb)/Math.max(0.1,cut/2-2.7*rb));        // lens swell
    };
    columnXs(x0,x1,pitch).forEach((x,i)=>{
      const off=y0+(i%2?period/2:0);
      for(const yc of centerYs(y0,y1,period,off)){
        const a=yc-cut/2, N=72, R:Polyline=[],L:Polyline=[];
        for(let k=0;k<=N;k++){
          const t=cut*k/N, w=half(t);
          R.push([x+w,a+t]); L.push([x-w,a+t]);
        }
        out.push(R.concat(L.reverse()).concat([[R[0][0],R[0][1]]]));
      }
    });
    return clipRect(out,x0,y0,x1,y1);
  },

  hexslit(s,x0,y0,x1,y1){
    // fequalsf.com "parametric kerf" #8 (reference DXF): flat-top, slightly
    // squashed hexagons. Each cell = a fully CLOSED inner hexagon (its core
    // drops out — by design, same as the fob) inside a broken outer outline
    // held by 3 corner bridges; webs of width hs remain between cells.
    const {hr,hs,gap}=s.p, R=hr, out:Polyline[]=[];
    const rw=Math.min(s.p.rw, R*0.55);                 // ring width (outer - inner)
    const SQ=0.8;                                      // vertical squash (reference look)
    const colStep=1.5*R+hs*0.87, rowStep=Math.sqrt(3)*R*SQ+hs;
    const hex=(r:number)=>{const v:Polyline=[];for(let k=0;k<6;k++){const th=Math.PI/3*k;
      v.push([r*Math.cos(th), r*Math.sin(th)*SQ]);}return v;};
    const Vi=hex(Math.max(R*0.35,R-rw)), Vo=hex(R);
    const cols=Math.ceil((x1-x0)/colStep)+2;
    for(let c=-1;c<cols;c++){
      const cx=x0+R+c*colStep;
      const yoff=(((c%2)+2)%2)?rowStep/2:0;
      const rows=Math.ceil((y1-y0)/rowStep)+2;
      for(let r=-1;r<rows;r++){
        const cy=y0+R*SQ+r*rowStep+yoff;
        const mv=(p:Point):Point=>[cx+p[0],cy+p[1]];
        out.push(Vi.concat([Vi[0]]).map(mv));          // inner hexagon: closed cut
        for(let e=0;e<6;e+=2){                         // outer: 3 two-edge pieces
          const A=Vo[e], B=Vo[(e+1)%6], C=Vo[(e+2)%6];
          const eL=Math.hypot(B[0]-A[0],B[1]-A[1]);
          const t=Math.min(0.45,(gap/2)/eL);
          out.push([lerpPt(A,B,t),B,lerpPt(B,C,1-t)].map(mv));
        }
      }
    }
    return clipRect(out,x0,y0,x1,y1);
  },

  tri(s,x0,y0,x1,y1){
    // fequalsf.com "parametric kerf" #9 (reference DXF): triangular grid; each
    // cell holds concentric inset triangle rings (spacing td). Even rings break
    // at the CORNERS, odd rings at the EDGE MIDPOINTS, so bridges alternate and
    // the material winds between rings. Cell edges themselves are never cut —
    // a solid web runs along the whole grid, so nothing drops out.
    const S=s.p.ts, d=s.p.td, g=s.p.gap, out:Polyline[]=[];
    const rowH=S*Math.sqrt(3)/2, apo=S/(2*Math.sqrt(3));
    const cell=(P0:Point,P1:Point,P2:Point)=>{
      const O:Point=[(P0[0]+P1[0]+P2[0])/3,(P0[1]+P1[1]+P2[1])/3];
      for(let k=0;k<40;k++){
        const f=1-d*(k+1)/apo;
        const E=f*S;
        if(E<Math.max(g*1.6+0.4, 2.2*d))break;
        const Q:Polyline=[P0,P1,P2].map((P):Point=>[O[0]+f*(P[0]-O[0]), O[1]+f*(P[1]-O[1])]);
        const t=Math.min(0.45,(g/2)/E);
        for(let i=0;i<3;i++){
          if(k%2===0){                                  // corner gaps -> edge pieces
            out.push([lerpPt(Q[i],Q[(i+1)%3],t), lerpPt(Q[i],Q[(i+1)%3],1-t)]);
          }else{                                        // mid-edge gaps -> corner chevrons
            out.push([lerpPt(Q[(i+2)%3],Q[i],0.5+t), Q[i], lerpPt(Q[i],Q[(i+1)%3],0.5-t)]);
          }
        }
      }
    };
    const rows=Math.ceil((y1-y0)/rowH)+2;
    for(let r=-1;r<rows;r++){
      const yb=y0+r*rowH, yt=yb+rowH;
      const xs=(((r%2)+2)%2)*(S/2);
      const cols=Math.ceil((x1-x0)/S)+2;
      for(let c=-2;c<cols;c++){
        const bx=x0+c*S+xs;
        cell([bx,yb],[bx+S,yb],[bx+S/2,yt]);            // up
        cell([bx+S/2,yt],[bx+1.5*S,yt],[bx+S,yb]);      // down
      }
    }
    return clipRect(out,x0,y0,x1,y1);
  }
};


export const PATTERNS: PatternDef[]=[
  {id:"straight",name:"直線",   params:["pitch","cut","gap"]},
  {id:"wave",    name:"ウェーブ",params:["pitch","cut","gap","amp","wlen"]},
  {id:"diamond", name:"ひし形", params:["pitch","cut","gap","dw"]},
  {id:"cross",   name:"クロス", params:["pitch","cut","gap","cw"]},
  {id:"arc",     name:"アーチ", params:["pitch","cut","gap","bulge"]},
  {id:"hex",     name:"ハニカム",params:["hr","hs","gap"]},
  {id:"hexslit", name:"スリット六角",params:["hr","hs","rw","gap"]},
  {id:"bone",    name:"ドッグボーン",params:["pitch","cut","gap","br"]},
  {id:"tri",     name:"入れ子三角",params:["ts","td","gap"]},
  {id:"spiral",  name:"メアンダー",params:["cs","sw"]},
];
/* プリセットは PATTERNS[].params の全キーを網羅すること（tools/smoke.mjs が検査する）。
   形状固有パラメータは列間隔 pitch に比例させ、モチーフの見た目の比率を3段階で揃える
   （既存の hr/cs/ts が「しなやか=細かい / しっかり=大きめ」で揃っているのと同じ考え方）。
   std は state.p の初期値と一致させること（初期状態＝標準プリセット）。 */
export const PRESETS: Record<PresetName, Params>={
  soft:{pitch:4,  cut:30, gap:1.5, dw:1.3, amp:1.1, wlen:13, cw:2.5, bulge:1.3, hr:4, hs:1.0, rw:0.9, cs:8,  sw:1.1, br:1.1, ts:14, td:0.8},
  std: {pitch:6,  cut:20, gap:2,   dw:2,   amp:1.6, wlen:18, cw:3.5, bulge:2,   hr:5, hs:1.4, rw:1.2, cs:10, sw:1.4, br:1.6, ts:18, td:1.0},
  firm:{pitch:9,  cut:14, gap:3,   dw:3,   amp:2.4, wlen:26, cw:5.5, bulge:3,   hr:7, hs:2.2, rw:1.8, cs:14, sw:2,   br:2.2, ts:24, td:1.5},
};
