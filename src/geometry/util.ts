import type { Point, Polyline } from "../types";

export const dist=(a:Point,b:Point):number=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export function lerpPt(a:Point,b:Point,t:number):Point{return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];}

/* clip a set of open polylines to half-plane f(p)>=0 */
export function clipHalf(polys:Polyline[],f:(p:Point)=>number):Polyline[]{
  const out:Polyline[]=[];
  for(const poly of polys){
    let cur:Polyline|null=null;
    for(let i=0;i<poly.length;i++){
      const p=poly[i],fp=f(p);
      if(i===0){ if(fp>=0)cur=[p]; continue; }
      const q=poly[i-1],fq=f(q);
      if(fq>=0&&fp>=0){ if(!cur)cur=[q]; cur.push(p); }
      else if(fq>=0&&fp<0){ const t=fq/(fq-fp); (cur||(cur=[q])).push(lerpPt(q,p,t)); if(cur.length>1)out.push(cur); cur=null; }
      else if(fq<0&&fp>=0){ const t=fq/(fq-fp); cur=[lerpPt(q,p,t),p]; }
    }
    if(cur&&cur.length>1)out.push(cur);
  }
  return out;
}
export function clipRect(polys:Polyline[],x0:number,y0:number,x1:number,y1:number):Polyline[]{
  let r=polys;
  r=clipHalf(r,p=>p[0]-x0);
  r=clipHalf(r,p=>x1-p[0]);
  r=clipHalf(r,p=>p[1]-y0);
  r=clipHalf(r,p=>y1-p[1]);
  return r.filter(p=>polyLen(p)>0.3);
}
export function polyLen(poly:Polyline):number{let l=0;for(let i=1;i<poly.length;i++)l+=dist(poly[i-1],poly[i]);return l;}

/* symmetric column x positions inside [x0,x1] */
export function columnXs(x0:number,x1:number,pitch:number):number[]{
  const w=x1-x0;
  const n=Math.max(1,Math.floor(w/pitch));
  const start=x0+(w-n*pitch)/2+pitch/2;
  const xs:number[]=[];
  for(let i=0;i<n;i++)xs.push(start+i*pitch);
  return xs;
}
/* cut interval centers along y, covering [y0,y1] with overflow */
export function centerYs(y0:number,y1:number,period:number,offset:number):number[]{
  const ys:number[]=[];
  const k0=Math.floor((y0-offset-period)/period);
  for(let k=k0;;k++){
    const y=offset+k*period;
    if(y>y1+period)break;
    if(y>=y0-period)ys.push(y);
  }
  return ys;
}
