import "./style.css";

import { state, GLOBAL_DEFS, PARAM_DEFS } from "./state";
import { board } from "./board";
import { GEN, PATTERNS, PRESETS } from "./geometry/patterns";
import { polyLen } from "./geometry/util";
import { MATERIALS, flexScoreOf, estMinRadius, genPolysFor } from "./material";
import { regenerate } from "./app";
import { fitView, renderView, view } from "./render2d";
import { renderStats } from "./ui/stats";
import { renderWarnings } from "./ui/warnings";
import { buildPatternCards, buildGlobalCtls, buildParamCtls, setThickness } from "./ui/controls";
import { buildTestSheet, renderTestNote } from "./ui/testsheet";
import { loadHash, scheduleHash } from "./ui/hash";
import { toast } from "./ui/toast";
import { makeDXF } from "./export/dxf";
import { makeSVG } from "./export/svg";

/* ---------- init ---------- */
loadHash();
document.querySelectorAll<HTMLElement>("#segMat button")
  .forEach(x => x.classList.toggle("on", x.dataset.mat === state.mat.kind));
setThickness(state.mat.thick);
buildPatternCards();
buildGlobalCtls();
buildParamCtls();
regenerate();
fitView();

/* ---------- 検証用フック ----------
   tools/golden.mjs と tools/smoke.mjs はここから内部を触る。
   ESM 化でトップレベルの const がグローバルでなくなったため、明示的に露出させている。
   アプリの動作には一切使わない。 */
declare global {
  interface Window { __app: typeof api }
}
const api = {
  state, GLOBAL_DEFS, PARAM_DEFS, board, GEN, PATTERNS, PRESETS, MATERIALS,
  polyLen, flexScoreOf, estMinRadius, genPolysFor,
  regenerate, renderView, renderStats, renderWarnings,
  buildPatternCards, buildGlobalCtls, buildParamCtls, setThickness,
  buildTestSheet, renderTestNote, loadHash, scheduleHash, toast,
  makeDXF, makeSVG,
  /** 可変バインディングは毎回読み直す必要があるため getter で露出する */
  get cuts() { return board.cuts; },
  get view() { return view; },
  get framePoly() { return board.framePoly; },
  get totalCutLen() { return board.totalCutLen; },
};
window.__app = api;
