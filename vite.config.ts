import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/* 契約 §1-3: 配布物は単一HTML・実行時ゼロ依存。
   ソースはモジュール分割してよいが、ビルド成果物は必ず1枚のHTMLに畳む。
   dist/index.html を livinghinge.html にリネームして公開する。 */
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024, // 画像等も必ずインライン化
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
