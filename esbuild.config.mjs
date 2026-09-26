import esbuild from "esbuild";
import builtins from "builtin-modules";

const mode = process.argv[2];
const prod = mode === "production";

if (mode === "test") {
  // 渲染层不依赖 obsidian，单独打包成 ESM 供 node 测试使用
  await esbuild.build({
    entryPoints: ["src/render/index.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: "test/.build/render.mjs",
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
  });
  if (prod) {
    await ctx.rebuild();
    process.exit(0);
  } else {
    await ctx.watch();
  }
}
