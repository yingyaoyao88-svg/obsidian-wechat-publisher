import esbuild from "esbuild";
import builtins from "builtin-modules";
import { readFileSync } from "node:fs";

const mode = process.argv[2];

// mathjax-full 未定义 PACKAGE_VERSION 时会用 eval("__dirname") 读 package.json，
// 在 Obsidian（浏览器环境）里会直接报错，所以构建时写死版本号
const { version: mathjaxVersion } = JSON.parse(readFileSync("node_modules/mathjax-full/package.json", "utf8"));
const define = { PACKAGE_VERSION: JSON.stringify(mathjaxVersion) };
const prod = mode === "production";

if (mode === "test") {
  // 渲染层不依赖 obsidian，单独打包成 ESM 供 node 测试使用
  await esbuild.build({
    entryPoints: { render: "src/render/index.ts", parse: "src/wechat/parse.ts" },
    bundle: true,
    format: "esm",
    platform: "node",
    outdir: "test/.build",
    outExtension: { ".js": ".mjs" },
    define,
    logLevel: "info",
  });
} else {
  const ctx = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtins],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    minify: prod,
    outfile: "main.js",
    define,
  });
  if (prod) {
    await ctx.rebuild();
    process.exit(0);
  } else {
    await ctx.watch();
  }
}
