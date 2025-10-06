import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";
import config from "./fixtures/webpack/webpack.config";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_FILE = path.resolve(__dirname, "./fixtures/webpack/dist/bundle.js");

function build(config: webpack.Configuration) {
  return new Promise<webpack.Stats>((resolve, reject) => {
    const compiler = webpack(config);
    if (!compiler) throw new Error("Webpack wasn't able to create a compiler instance. Check the webpack config.");
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (!stats) return reject(new Error("No stats"));
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      compiler.close((closeErr) => (closeErr ? reject(closeErr) : resolve(stats)));
    });
  });
}

test("webpack builds and runs", { concurrency: false }, async () => {
  const stats = await build(config);
  assert.equal(stats.hasWarnings(), false, stats.toString({ all: false, warnings: true }));
  assert.ok(fs.existsSync(OUT_FILE), "bundle.js not emitted");

  const js = fs.readFileSync(OUT_FILE, "utf8");
  // The `__WEBPACK_SMOKE_OK__` marker comes from DefinePlugin. It must be present if the bundle includes our entry.
  assert.match(js, /__WEBPACK_SMOKE_OK__/, "smoke marker not found in bundle");
});
