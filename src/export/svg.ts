import type { Polyline } from "../types";
import { state } from "../state";
import { num, allPolys } from "./format";

export function makeSVG(polys?:Polyline[],boardW?:number,boardH?:number):string{
  const W=boardW!==undefined?boardW:state.W, H=boardH!==undefined?boardH:state.H;
  polys=polys||allPolys();
  let body="";
  for(const p of polys){
    body+=p.length===2
      ?`<line x1="${num(p[0][0])}" y1="${num(p[0][1])}" x2="${num(p[1][0])}" y2="${num(p[1][1])}"/>\n`
      :`<polyline points="${p.map((q)=>num(q[0])+","+num(q[1])).join(" ")}"/>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n`+
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n`+
`<g fill="none" stroke="#FF0000" stroke-width="0.1">\n${body}</g>\n</svg>`;
}
