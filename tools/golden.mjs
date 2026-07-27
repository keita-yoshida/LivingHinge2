/**
 * ゴールデン出力の採取／照合ツール
 *
 *   node tools/golden.mjs capture   … tests/golden/ を作り直す
 *   node tools/golden.mjs check     … 現行 index.html の出力がゴールデンと一致するか検証
 *
 * 実ブラウザ(Chromium)で index.html を読み込み、アプリ本体の
 * regenerate() / makeDXF() / makeSVG() / buildTestSheet() をそのまま呼ぶ。
 * つまりユーザーがダウンロードボタンを押したときと同じ経路の出力を保存する。
 *
 * 3Dプレビュー削除・Vite移植など「出力を変えないはずの改修」の前後で
 * check を通すことで、リグレッションをバイト単位で検出する。
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// playwright はグローバル導入のみ（このリポジトリは依存ゼロを維持中）
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = path.join(ROOT, "tests", "golden");
const TARGET = "index.html";
const PORT = 8791;

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/* ---------- 採取マトリクス ---------- */
const PATTERNS = ["straight", "wave", "diamond", "cross", "arc", "hex", "hexslit", "bone", "tri", "spiral"];
const PRESETS = ["soft", "std", "firm"];
const BASE = { W: 120, H: 70, margin: 0, frame: true };

function buildCases() {
  const cases = [];
  // 1) 全パターン × 全プリセット × 両方向（本体出力）
  for (const pattern of PATTERNS)
    for (const preset of PRESETS)
      for (const dir of ["v", "h"])
        cases.push({ id: `board__${pattern}__${preset}__${dir}`, kind: "board", pattern, preset, dir, ...BASE });

  // 2) 余白あり（tri は margin>=2 推奨。他パターンも外周クリップの挙動を固定する）
  for (const pattern of PATTERNS)
    cases.push({ id: `margin2__${pattern}__std__v`, kind: "board", pattern, preset: "std", dir: "v", ...BASE, margin: 2 });

  // 3) 外枠なし
  cases.push({ id: `noframe__straight__std__v`, kind: "board", pattern: "straight", preset: "std", dir: "v", ...BASE, frame: false });

  // 4) メアンダー極端値（CLAUDE.md §6.2 の連結性検証と同じ条件）
  cases.push({ id: `extreme__spiral__fine`,  kind: "board", pattern: "spiral", preset: "std", dir: "v", ...BASE, p: { cs: 5,  sw: 0.8 } });
  cases.push({ id: `extreme__spiral__coarse`,kind: "board", pattern: "spiral", preset: "std", dir: "v", ...BASE, p: { cs: 40, sw: 5 } });
  cases.push({ id: `extreme__spiral__odd`,   kind: "board", pattern: "spiral", preset: "std", dir: "v", ...BASE, p: { cs: 13, sw: 1.7 } });

  // 5) サイズ極端値（列配置・クリップの端条件）
  cases.push({ id: `size__straight__small`, kind: "board", pattern: "straight", preset: "std", dir: "v", W: 20, H: 20, margin: 0, frame: true });
  cases.push({ id: `size__hex__large`,      kind: "board", pattern: "hex",      preset: "std", dir: "v", W: 400, H: 300, margin: 0, frame: true });

  // 6) テストピース面付け（§7.5）
  for (const pattern of PATTERNS)
    cases.push({ id: `testsheet__${pattern}__std`, kind: "testsheet", pattern, preset: "std", dir: "v", ...BASE });

  return cases;
}

/* ---------- 静的サーバ（file:// はキャッシュ事故があるため http で配信: CLAUDE.md §6.3.5） ---------- */
function serve(dir, port) {
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(req.url.split("?")[0].split("#")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.join(dir, rel);
      if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

/* ---------- ブラウザ内で1ケース分の出力を作る ---------- */
/* この関数はページ側で評価される。アプリのグローバル(state/GEN/makeDXF...)を直接使う。 */
const EXTRACT = (c) => {
  // パラメータプールは累積変化するので毎回まっさらな既定値へ戻す
  Object.keys(window.__defaultP).forEach((k) => { state.p[k] = window.__defaultP[k]; });
  Object.assign(state.p, PRESETS[c.preset]);
  if (c.p) Object.assign(state.p, c.p);
  state.pattern = c.pattern;
  state.dir = c.dir;
  state.W = c.W; state.H = c.H;
  state.margin = c.margin; state.frame = c.frame;
  regenerate();

  const round = (v) => Math.round(v * 1000) / 1000;
  if (c.kind === "testsheet") {
    const t = buildTestSheet();
    return {
      dxf: makeDXF(t.polys, t.H),
      svg: makeSVG(t.polys, t.W, t.H),
      stats: { polylines: t.polys.length, W: round(t.W), H: round(t.H), key: t.key, vals: t.vals },
    };
  }
  const flex = flexScoreOf(cuts, state.p, state.pattern);
  return {
    dxf: makeDXF(),
    svg: makeSVG(),
    stats: {
      polylines: cuts.length + (framePoly ? 1 : 0),
      cutLen: round(totalCutLen),
      flexScore: round(flex),
      minRadius: round(estMinRadius(flex)),
      params: Object.fromEntries(PATTERNS.find((x) => x.id === state.pattern).params.map((k) => [k, state.p[k]])),
    },
  };
};

/* ---------- 本体 ---------- */
async function run(mode) {
  const cases = buildCases();
  const src = await readFile(path.join(ROOT, TARGET), "utf8");
  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  // favicon 等の副次リクエストの 404 は出力に無関係なので除外する
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    pageErrors.push("console: " + t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/${TARGET}`, { waitUntil: "load" });
  await page.evaluate(() => { window.__defaultP = JSON.parse(JSON.stringify(state.p)); });
  if (pageErrors.length) throw new Error("読み込み時にエラー:\n" + pageErrors.join("\n"));

  const manifest = {
    tool: "tools/golden.mjs",
    target: TARGET,
    targetSha256: sha(src),
    capturedAt: new Date().toISOString().slice(0, 10),
    caseCount: cases.length,
    cases: {},
  };

  if (mode === "capture") {
    if (existsSync(GOLDEN_DIR)) await rm(GOLDEN_DIR, { recursive: true });
    await mkdir(GOLDEN_DIR, { recursive: true });
  }

  const diffs = [];
  for (const c of cases) {
    const out = await page.evaluate(EXTRACT, c);
    if (pageErrors.length) throw new Error(`[${c.id}] 実行時エラー:\n` + pageErrors.join("\n"));

    manifest.cases[c.id] = {
      dxf: { bytes: Buffer.byteLength(out.dxf), sha256: sha(out.dxf) },
      svg: { bytes: Buffer.byteLength(out.svg), sha256: sha(out.svg) },
      ...out.stats,
    };

    for (const [ext, text] of [["dxf", out.dxf], ["svg", out.svg]]) {
      const file = path.join(GOLDEN_DIR, `${c.id}.${ext}`);
      if (mode === "capture") { await writeFile(file, text); continue; }
      if (!existsSync(file)) { diffs.push(`${c.id}.${ext}: ゴールデンが存在しない`); continue; }
      const old = await readFile(file, "utf8");
      if (old !== text) {
        diffs.push(`${c.id}.${ext}: 不一致 (${Buffer.byteLength(old)} → ${Buffer.byteLength(text)} bytes)`);
      }
    }
  }

  await browser.close();
  server.close();

  if (mode === "capture") {
    await writeFile(path.join(GOLDEN_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    const files = await readdir(GOLDEN_DIR);
    const total = manifest.cases;
    const bytes = Object.values(total).reduce((a, x) => a + x.dxf.bytes + x.svg.bytes, 0);
    console.log(`採取完了: ${cases.length} ケース / ${files.length} ファイル / ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`index.html sha256 = ${manifest.targetSha256}`);
  } else {
    const prev = JSON.parse(await readFile(path.join(GOLDEN_DIR, "manifest.json"), "utf8"));
    if (diffs.length) {
      console.error(`✗ 出力が変化しています（${diffs.length} 件）`);
      diffs.slice(0, 40).forEach((d) => console.error("  " + d));
      if (diffs.length > 40) console.error(`  … 他 ${diffs.length - 40} 件`);
      console.error(`\nゴールデン採取時の index.html: ${prev.targetSha256}`);
      process.exit(1);
    }
    console.log(`✓ ${cases.length} ケース すべて一致（DXF/SVG 計 ${cases.length * 2} ファイル）`);
  }
}

const mode = process.argv[2];
if (mode !== "capture" && mode !== "check") {
  console.error("usage: node tools/golden.mjs <capture|check>");
  process.exit(2);
}
run(mode).catch((e) => { console.error(e); process.exit(1); });
