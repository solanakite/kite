import { defineConfig, Options } from "tsup";

const removeNodePrefixPlugin: NonNullable<Options["esbuildPlugins"]>[0] = {
  name: "remove-node-prefix",
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => {
      const moduleName = args.path.substring("node:".length);
      return { path: moduleName, external: true };
    });
  },
};

const common: Options = {
  sourcemap: true,
  format: "esm",
  outDir: "dist",
};

export default defineConfig([
  { ...common, entry: { "index.node": "src/index.ts" } },
  { ...common, entry: { "index.browser": "src/index.ts" }, esbuildPlugins: [removeNodePrefixPlugin] },
  { ...common, entry: ["src/index.ts"], dts: { only: true } },
]);
