import * as esbuild from "esbuild";

const isDev = process.argv.includes("--dev");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  platform: "node",
  target: "es2020",
  outfile: "main.js",
  external: ["obsidian"],
  sourcemap: isDev,
  minify: !isDev,
});

if (isDev) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
  console.log("Build complete.");
}
