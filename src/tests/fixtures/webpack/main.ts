declare const __SMOKE__: string;

import * as kite from "solana-kite";

if (!kite || typeof kite !== "object") {
  throw new Error("Package did not import correctly");
}

// This is necessary so __SMOKE__ doesn't get tree-shaken
(globalThis as any).__pkgSmoke = {
  marker: __SMOKE__,
};
