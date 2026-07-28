import type { Point } from "./types";
import { state } from "./state";
import { board } from "./board";
import { genPolysFor } from "./material";
import { renderView } from "./render2d";
import { renderStats } from "./ui/stats";
import { renderWarnings } from "./ui/warnings";
import { renderTestNote } from "./ui/testsheet";
import { scheduleHash } from "./ui/hash";

/* 生成のエントリポイント。
   このモジュールは UI から一方向に呼ばれるだけで、UI 側を import しない。
   （controls → app → render/stats/warnings/hash の一方向にして循環を避けている） */
export function regenerate() {
  let polys = genPolysFor(state.p);
  if (state.dir === "h") { // transpose
    polys = polys.map(p => p.map(([x, y]) => [y, x] as Point));
  }
  board.cuts = polys;
  board.framePoly = state.frame
    ? [[0, 0], [state.W, 0], [state.W, state.H], [0, state.H], [0, 0]]
    : null;
  renderView();
  renderStats();
  renderWarnings();
  renderTestNote();
  scheduleHash();
}
