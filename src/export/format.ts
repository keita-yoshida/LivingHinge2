import type { Polyline } from "../types";
import { board } from "../board";

export function num(v:number):string{return (+v.toFixed(4)).toString();}
export function allPolys():Polyline[]{
  const list=board.cuts.slice();
  if(board.framePoly)list.push(board.framePoly);
  return list;
}
