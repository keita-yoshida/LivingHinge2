import type { Polyline } from "../types";
import { state } from "../state";
import { num, allPolys } from "./format";

export function makeDXF(polys?:Polyline[],boardH?:number):string{
  const H=boardH!==undefined?boardH:state.H;
  polys=polys||allPolys();
  let s="0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n";
  s+="0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\nCUT\n70\n0\n62\n1\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n";
  s+="0\nSECTION\n2\nENTITIES\n";
  for(const p of polys){
    if(p.length===2){
      s+=`0\nLINE\n8\nCUT\n10\n${num(p[0][0])}\n20\n${num(H-p[0][1])}\n11\n${num(p[1][0])}\n21\n${num(H-p[1][1])}\n`;
    }else{
      s+="0\nPOLYLINE\n8\nCUT\n66\n1\n70\n0\n";
      for(const pt of p){
        s+=`0\nVERTEX\n8\nCUT\n10\n${num(pt[0])}\n20\n${num(H-pt[1])}\n`;
      }
      s+="0\nSEQEND\n";
    }
  }
  s+="0\nENDSEC\n0\nEOF\n";
  return s;
}
