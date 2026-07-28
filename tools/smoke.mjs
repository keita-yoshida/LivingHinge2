/**
 * UI スモークテスト
 *
 *   node tools/smoke.mjs
 *
 * ゴールデン照合(tools/golden.mjs)は書き出し結果しか見ないので、
 * 画面まわりの回帰はこちらで検出する。
 *
 * CLAUDE.md §5 の教訓に従い、ポインタ操作は dispatchEvent の合成イベントではなく
 * Playwright の mouse.down/move/up による実ポインタ操作で行う
 * (setPointerCapture 絡みのバグは合成イベントでは再現しないため)。
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 検証対象はビルド成果物（実際に配布される単一HTML）
const TARGET = process.env.HINGE_TARGET || "dist/index.html";
const PORT = 8792;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? "  " + detail : ""}`);
};

function serve(dir, port) {
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(req.url.split("?")[0].split("#")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.join(dir, rel);
      if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

const URL_BASE = `http://127.0.0.1:${PORT}/${TARGET}`;

async function main() {
  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.setDefaultTimeout(5000);   // 既定30秒だとセレクタを外したとき静かに詰まる

  let errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return;
    errors.push("console: " + m.text());
  });
  const takeErrors = () => { const e = errors; errors = []; return e; };

  await page.goto(URL_BASE, { waitUntil: "load" });
  // 以降の操作で state が書き換わるため、初期値をここで控えておく
  await page.evaluate(() => { window.__defaults = JSON.parse(JSON.stringify({ p: window.__app.state.p, mat: window.__app.state.mat })); });
  check("初期読み込みでエラーが出ない", takeErrors().length === 0, errors.join(" / "));

  /* --- 3D の痕跡が残っていないこと --- */
  const leftovers = await page.evaluate(() => ({
    canvas: !!document.getElementById("pv3d"),
    bendbar: !!document.querySelector(".bendbar"),
    viewBtns: [...document.querySelectorAll("#segView button")].map((b) => b.dataset.view),
    globals: ["s3", "build3d", "render3d", "fit3d", "zoom3d", "is3d", "scheduleBuild"].filter((k) => k in window || k in window.__app),
    styleHas3d: [...document.styleSheets[0].cssRules].some((r) => /mode3d|bendbar|bend-/.test(r.cssText || "")),
  }));
  check("canvas#pv3d が存在しない", !leftovers.canvas);
  check(".bendbar が存在しない", !leftovers.bendbar);
  check("表示モードが板/レーザーの2つ", JSON.stringify(leftovers.viewBtns) === '["wood","laser"]', leftovers.viewBtns.join(","));
  check("3D関連のグローバルが残っていない", leftovers.globals.length === 0, leftovers.globals.join(","));
  check("3D関連のCSSルールが残っていない", !leftovers.styleHas3d);

  /* --- 全パターンをカードの実クリックで切り替えて生成できること --- */
  const patIds = await page.evaluate(() => window.__app.PATTERNS.map((p) => p.id));
  let genOk = true; const genDetail = [];
  for (const id of patIds) {
    await page.click(`#patternCards .pat[data-id="${id}"]`);
    const r = await page.evaluate(() => {
      const A = window.__app;
      const nan = A.cuts.some((p) => p.some((q) => !isFinite(q[0]) || !isFinite(q[1])));
      return { pat: A.state.pattern, n: A.cuts.length, nan };
    });
    if (r.pat !== id || r.n === 0 || r.nan) { genOk = false; genDetail.push(`${id}:n=${r.n}${r.nan ? " NaN" : ""}`); }
  }
  check(`全${patIds.length}パターンをカードクリックで生成できる`, genOk && takeErrors().length === 0, genDetail.join(" "));

  /* --- 表示モード切替 --- */
  await page.evaluate(() => { const A = window.__app; A.state.pattern = "straight"; A.buildParamCtls(); A.regenerate(); });
  await page.click('#segView button[data-view="laser"]');
  const laserOk = await page.evaluate(() => window.__app.state.view === "laser" && document.getElementById("gCuts").children.length > 0);
  await page.click('#segView button[data-view="wood"]');
  const woodOk = await page.evaluate(() => window.__app.state.view === "wood" && document.getElementById("gBoard").children.length > 0);
  check("表示モード切替が動く", laserOk && woodOk && takeErrors().length === 0);

  /* --- 実ポインタでのパン（§5: 合成イベントでは検出できない） --- */
  const box = await page.locator("#viewport").boundingBox();
  const before = await page.evaluate(() => ({ ...window.__app.view }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ ...window.__app.view }));
  check("実ドラッグでパンできる", after.x > before.x + 1 && after.y > before.y + 1,
    `x ${before.x.toFixed(1)}→${after.x.toFixed(1)}`);

  /* --- ホイールズーム / ダブルクリックで全体表示 --- */
  const zw0 = await page.evaluate(() => window.__app.view.w);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  const zw1 = await page.evaluate(() => window.__app.view.w);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const zw2 = await page.evaluate(() => ({ w: window.__app.view.w, x: window.__app.view.x }));
  check("ホイールでズームする", zw1 < zw0 - 0.01, `w ${zw0.toFixed(1)}→${zw1.toFixed(1)}`);
  check("ダブルクリックで全体表示に戻る", Math.abs(zw2.w - zw0) < 0.5, `w=${zw2.w.toFixed(1)}`);

  /* --- 板厚スライダー（3D側と共有していた setThickness） --- */
  // 左パネルはスクロールするので、画面外だとマウス操作が届かない（boundingBox はページ座標を返す）
  await page.locator("#matThickRng").scrollIntoViewIfNeeded();
  const thickBox = await page.locator("#matThickRng").boundingBox();
  const r0 = await page.textContent("#minR");
  await page.mouse.move(thickBox.x + thickBox.width * 0.1, thickBox.y + thickBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thickBox.x + thickBox.width * 0.8, thickBox.y + thickBox.height / 2, { steps: 6 });
  await page.mouse.up();
  const t1 = await page.evaluate(() => window.__app.state.mat.thick);
  const r1 = await page.textContent("#minR");
  check("板厚スライダーが効き最小曲げ半径に反映される", t1 > 3 && r1 !== r0 && takeErrors().length === 0,
    `厚 3→${t1}mm / R ${r0}→${r1}mm`);

  /* --- プリセット --- */
  await page.click('[data-preset="soft"]');
  const softP = await page.evaluate(() => window.__app.state.p.pitch);
  await page.click('[data-preset="firm"]');
  const firmP = await page.evaluate(() => window.__app.state.p.pitch);
  check("プリセットが反映される", softP === 4 && firmP === 9, `pitch soft=${softP} firm=${firmP}`);

  /* --- プリセットの網羅性（CLAUDE.md §3.4 手順3 / §7.2 の欠陥の再発防止） ---
     PATTERNS[].params の全キーが3プリセットすべてに存在しないと、
     そのパターンではプリセットが形状に効かない。 */
  const presetGaps = await page.evaluate(() => {
    const { PATTERNS, PRESETS } = window.__app;
    const need = [...new Set(PATTERNS.flatMap((p) => p.params))];
    const miss = [];
    for (const [name, preset] of Object.entries(PRESETS))
      for (const k of need) if (!(k in preset)) miss.push(`${name}.${k}`);
    return miss;
  });
  check("PRESETS が全パターンの全パラメータを網羅している", presetGaps.length === 0, presetGaps.join(" "));

  /* --- 初期値＝標準プリセット（プリセット追加時にずれやすい） --- */
  const stdMatchesDefault = await page.evaluate(() => {
    const diff = [];
    for (const [k, v] of Object.entries(window.__app.PRESETS.std)) if (window.__defaults.p[k] !== v) diff.push(`${k}:${window.__defaults.p[k]}≠${v}`);
    return diff;
  });
  check("初期パラメータが標準プリセットと一致する", stdMatchesDefault.length === 0, stdMatchesDefault.join(" "));

  /* --- 全パターン×全プリセットで自動制限の警告が出ないこと ---
     形状幅が列間隔に近すぎると diamond/cross は自動的に切り詰められる。
     プリセット値がその領域に入っていたら、プリセットの設計ミス。 */
  const clampWarns = await page.evaluate(() => {
    const A = window.__app;
    const bad = [];
    for (const name of ["soft", "std", "firm"])
      for (const pat of A.PATTERNS.map((p) => p.id)) {
        A.state.pattern = pat; Object.assign(A.state.p, A.PRESETS[name]); A.regenerate();
        const t = document.getElementById("warns").textContent;
        if (/自動的に制限/.test(t)) bad.push(`${pat}/${name}`);
      }
    return bad;
  });
  check("プリセット値で形状の自動制限が発生しない", clampWarns.length === 0, clampWarns.join(" "));

  /* --- 目標半径の逆算ソルバー --- */
  await page.evaluate(() => { const A = window.__app; A.state.mat.thick = 3; A.setThickness(3); A.state.pattern = "straight"; A.buildParamCtls(); A.regenerate(); });
  await page.fill("#targetR", "60");
  await page.click("#btnSolve");
  const solved = await page.evaluate(() => { const A = window.__app; return { R: A.estMinRadius(A.flexScoreOf(A.cuts, A.state.p, A.state.pattern)), pitch: A.state.p.pitch }; });
  check("逆算ソルバーが目標半径に寄せる", Math.abs(solved.R - 60) / 60 < 0.15 && takeErrors().length === 0,
    `目標60mm → 推定${solved.R.toFixed(1)}mm`);

  /* --- 書き出しが実際に生成できる --- */
  const exp = await page.evaluate(() => {
    const A = window.__app;
    const dxf = A.makeDXF(), svg = A.makeSVG();
    return {
      dxfEnds: dxf.trimEnd().endsWith("EOF"),
      dxfLayer: (dxf.match(/\nCUT\n/g) || []).length > 0,
      svgHead: /width="\d+(\.\d+)?mm" height="\d+(\.\d+)?mm" viewBox="0 0 /.test(svg),
      svgNoText: !/<text/.test(svg),
      sheet: (() => { const t = A.buildTestSheet(); return t.polys.length > t.vals.length; })(),
    };
  });
  check("DXFがEOFで終端しCUTレイヤーを持つ", exp.dxfEnds && exp.dxfLayer);
  check("SVGがmm実寸ヘッダでテキスト要素を含まない", exp.svgHead && exp.svgNoText);
  check("テストピース面付けが生成できる", exp.sheet);

  /* --- hash 往復 --- */
  await page.evaluate(() => {
    const A = window.__app, { state } = A;
    state.pattern = "hex"; state.W = 200; state.H = 90; state.margin = 2;
    state.mat.kind = "ply"; state.p.hr = 6.5;
    A.buildParamCtls(); A.regenerate(); A.scheduleHash();
  });
  await page.waitForTimeout(600);
  const sharedUrl = page.url();
  await page.goto("about:blank");
  await page.goto(sharedUrl, { waitUntil: "load" });
  const restored = await page.evaluate(() => { const { state } = window.__app; return { pattern: state.pattern, W: state.W, H: state.H, margin: state.margin, kind: state.mat.kind, hr: state.p.hr }; });
  check("hash往復で設定が復元される",
    restored.pattern === "hex" && restored.W === 200 && restored.H === 90 && restored.margin === 2 && restored.kind === "ply" && restored.hr === 6.5,
    JSON.stringify(restored));

  /* --- 旧形式 hash（廃止済み p.web 入り・mat 無し）で無エラー起動（契約 §1-4） --- */
  const legacy = encodeURIComponent(JSON.stringify({
    pattern: "spiral", W: 120, H: 70, frame: true, dir: "v", margin: 0,
    p: { pitch: 6, cut: 20, gap: 2, cs: 10, sw: 1.4, web: 2 },
  }));
  // 同一URLでハッシュだけ変えても再読み込みされないので、必ず一度離脱する
  await page.goto("about:blank");
  await page.goto(`${URL_BASE}#${legacy}`, { waitUntil: "load" });
  const legacyState = await page.evaluate(() => { const A = window.__app; return { pattern: A.state.pattern, kind: A.state.mat.kind, thick: A.state.mat.thick, n: A.cuts.length }; });
  check("旧形式hash(p.web入り/mat無し)で無エラー起動しmatは既定値",
    legacyState.pattern === "spiral" && legacyState.kind === "mdf" && legacyState.thick === 3 && legacyState.n > 0 && takeErrors().length === 0,
    JSON.stringify(legacyState));

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? "✗" : "✓"} ${results.length - failed.length}/${results.length} 項目が成功`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
