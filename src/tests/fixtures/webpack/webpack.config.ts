import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Configuration } from "webpack";
import pkg from "../../../../package.json";
import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: Configuration = {
  mode: "production",
  target: "web",
  entry: path.resolve(__dirname, "main.ts"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    clean: true,
  },
  resolve: {
    alias: {
      [pkg.name]: path.resolve(__dirname, "../../../.."),
    },

    extensions: [".ts", ".tsx", ".mjs", ".js"],

    // Make sure webpack prefers the browser build/fields like a real app
    conditionNames: ["webpack", "browser", "import", "module", "default"],
    aliasFields: ["browser"],
    mainFields: ["browser", "module", "main"],

    fallback: {
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
      os: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.[cm]?ts?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "tsconfig.json"),
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __SMOKE__: JSON.stringify("__WEBPACK_SMOKE_OK__"),
    }),
  ],

  stats: "errors-warnings",
  infrastructureLogging: { level: "error" },
};

export default config;
