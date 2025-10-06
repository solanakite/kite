# Contributing

## Styleguide

To kee content consistent and high-quality experience, here's a styleguide,
based on the [Solana Foundation styleguide](https://github.com/solana-foundation/developer-content/blob/main/CONTRIBUTING.md).

### Prose

The guidelines below are consistent with Solana Foundation Style Guide, and
[TERMINOLOGY](https://github.com/solana-foundation/developer-content/blob/main/docs/terminology.md),
to ensure consistency with other content on solana.com. There are also a few
additional items aimed at technical documents.

In particular:

- Please run a grammar check (not just a spell check) before creating a PR -
  this will catch many of the small errors that occur from your editing process,
  and save the person reviewing your PR some time. We recommend
  [Grammarly](https://grammarly.com/). In
  [your Grammarly dictionary](https://account.grammarly.com/customize), you may
  wish to add Solana-specific words like `lamport`, `blockhash`, etc.
- Use US English rather than British English. Grammarly will catch this for you.
- Use 'onchain' (not on-chain, definitely not smart contract) when referring to
  onchain apps. This comes from the Solana Foundation style guide, and is
  intended to be similar to 'online'.
- Use sentence case for headlines (”Solana Foundation announces new initiative”
  instead of “Solana Foundation Announces New Initiative”). This also comes from
  the Solana Foundation style guide.
- Use the terms 'blockchain' or 'web3' rather than 'crypto'.
- Use 'SOL' rather than 'Sol' to refer to Solana's native token. Don't call the
  native token 'Solana'!
- Use 'wallet app' for software. 'wallet' for the address that holds value, to
  avoid confusion between these two concepts.
- PDAs are not public keys. It is not possible to have a public key without a
  secret key. A public key is derived from a secret key, and it is not possible
  to generate a public key without first generating a secret key.
- Be careful about the term 'token account'. A
  ['token account' is any account formatted to hold tokens](https://solana.stackexchange.com/questions/7507/what-is-the-difference-between-a-token-account-and-an-associated-token-account),
  and being specific (rather than, for example, swapping between 'associated
  token account' and 'token account') makes this clearer.
  - Use the specific term 'associated token account' rather than just 'token
    account' if you're referring to an account at an associated token address.
  - Use 'token mint account' to refer to the address where a token is minted.
    E.g., the
    [USDC mainnet token mint account](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v).
    Use apostrophes of possession,
    [including for inanimate objects](https://english.stackexchange.com/questions/1031/is-using-the-possessive-s-correct-in-the-cars-antenna).
    Eg 'the account's balance' is correct.
- Don't use 'here' links. They make the course hard to scan and
  ['here' links are bad for SEO](https://www.smashingmagazine.com/2012/06/links-should-never-say-click-here/).
- JS/TS clients send `transactions` made from `instructions`. Onchain programs
  have `instruction handlers` that process `instructions`. Do not refer to
  [instruction handlers](https://solana.com/docs/terminology#instruction-handler)
  as instructions! The reason is simple: an instruction cannot process an
  instruction. The `multiple` template in Anchor also calls these functions
  `handler`s.

### Code

You're writing code to be read, understood, and changed by others.

We want the minimal amount of code necessary to solve the problem.

- Use full names. Call a `thing` a `thing`. Don't call it a `thg` - this means
  we don't have to say 'thing, spelled tee aitch gee' every time we talk about
  it, and means developers (who often don't speak English as a first language)
  have to work out that 'thg' means 'thing'.
- Avoid repetitive, copy-paste code. This helps others change the code easily,
  as they can update and fix things in a single place. If there's some
  boilerplate, Solana-specific code you always need
  [make a PR to the 'helpers' repository](https://github.com/solana-developers/helpers).
- Avoid magic numbers. Nobody should see a `+ 32` in your code and wonder what
  the `32` means. See Anchor notes below for Anchor-specific advice.

#### JS/TS

We're trying to focus on Solana, not teaching JS/TS development and setup. This
means reducing the JS/TS concepts needed to understand our demo code.

- On the command line (not in the browser),`.ts` files are run on the command
  line with `esrun`, which supports top-level `await`, doesn't require a
  `tsconfig.json`, etc. There is no need for `async function main()` wrappers or
  [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE). `await` just
  works. If you see these wrappers, remove them.

- Likewise, use `async`/`await` and consistently use `try` / `catch` all the
  time, rather than sometimes using `.then()` and `.catch()`

- Throw errors with `throw new Error('message')`. Don't throw strings (JS allows
  almost any type to be thrown). TS code can assume anything thrown is of the
  `Error` type.

- Don't make custom helper functions. Instead, use the
  `@solana-developers/helpers` package. If you need a function that doesn't
  exist, make a PR to `@solana-developers/helpers`, and add the helper, tests,
  and docs.

- Write tests so we can run your code and ensure a new release of something
  doesn't break your code. Ensure your tests make sense. BDD style (which Anchor
  uses by default) uses `describe` and `it` to create the names. So
  `describe('the plus operator', () => {}` becomes `describe the plus operation`
  when the tests run, and `it('adds numbers', () => {...})` becomes
  `it adds numbers` when the tests run. Ensure your test names make sense!

- Use prettier to help maintain the quality and consistency of the content.
  There is a master
  [prettier configuration file](https://github.com/solana-foundation/developer-content/blob/main/.prettierrc)
  (`.prettierrc`) at the root of this repo. Note that while `prettier` can
  format Markdown,
  [prettier doesn't yet support language-specific settings inside Markdown files](https://github.com/prettier/prettier/issues/5378)
  so you'll need to format the code yourself for now. To do this quickly, make a
  blank `deleteme.ts` file, paste your code in there, and then save it (allowing
  prettier to do its work), and paste it back into the document.

On all commits and PRs, there is a GitHub action that checks if your PR follows
the configured prettier formatting. If your branch/code does NOT meet the
prettier formatting requirements, it will not be merged and it will delay its
review.

If your editor is not configured to auto-format on save using prettier, then you
can run the following command to auto-format all files in your local repo/PR:

```shell
pnpm prettier:fix
```

You can also run the prettier check command to see which files do not follow the
prettier formatting guidelines.

```shell
pnpm prettier
```

#### Rust & Anchor

- Avoid magic numbers. People reading your code should be able to understand
  where values come from. Use
  [InitSpace](https://docs.rs/anchor-lang/latest/anchor_lang/derive.InitSpace.html)
  to calculate space needed for accounts, and add a constant
  `DISCRIMINATOR_SIZE` to `constants.rs`.

  - Bad: `8 + 32 + 32 + 8 + 8`

  - Good: `space = DISCRIMINATOR_SIZE + SomeAccount::INIT_SPACE`

- Use `rustfmt`.

- Use `UncheckedAccount` rather than `AccountInfo`. `UncheckedAccount` is a much
  better name, and makes it explicit that the account is not being checked by
  Anchor.

- Don't manually ask people to edit `declare_id!()` and `Anchor.toml`. Instead,
  ask them to run `anchor keys sync`.

- Use the
  [multiple files template](https://www.anchor-lang.com/release-notes/0.29.0#multiple-files-template)
  to organize very large Anchor projects.

#### Whimsical diagrams

> Note: The preferred way to display a Whimsical diagram is to export the
> diagram as an SVG and directly [embed the image](#images) within a specific
> piece of content. You can get an SVG export from Whimsical by appending `/svg`
> to the end of a Whimsical URL.

- If you draw Solana elliptic curves, these are
  [Edwards curves](https://en.wikipedia.org/wiki/Edwards_curve). This is
  [what the curve Ed25519 uses looks like](https://www.wolframalpha.com/input?i=x%5E2+%2B+y%5E2+%3D+1+-+%28121665%2F121666%29*x%5E2*y%5E2).
  Solana public keys are the Y values on this curve (we can omit the X value
  because the curve is symmetrical). Ed25519 is symmetrical, and looks like a
  slightly deflated beach ball. **Do not draw a snake or some other kind or
  curve!**

## Development Setup

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

## Build & Packaging

Kite ships **separate entry points** for Node and browser environments.
This avoids issues where bundlers (like Webpack in Next.js) try to pull in Node built-ins (e.g. `fs/promises`, `path`) into client bundles.

### Outputs

| Target  | File                    | Notes                                                     |
| ------- | ----------------------- | --------------------------------------------------------- |
| Node    | `dist/index.node.js`    | Full Node features (includes Node built-ins).             |
| Browser | `dist/index.browser.js` | Safe for client bundles (Node built-ins removed/stubbed). |
| Types   | `dist/index.d.ts`       | Shared between both builds.                               |

### How resolution works

- `main` / `module` → `dist/index.node.js`
- `exports` includes a **`browser` condition** → `dist/index.browser.js`
- `browser` field:
  - Maps Node built-ins like `fs/promises` and `path` → `false`
  - Redirects `index.node.js` → `index.browser.js` in browser builds

**Result:**

- Node (CLI, server, SSR) resolves `index.node.js`
- Browser bundlers (Webpack, Vite, Next.js client) resolve `index.browser.js`

### Why the `browser` field?

Bundlers like Webpack **statically analyze** the dependency graph. Even dynamic imports of Node built-ins can cause client-side builds to fail.
The `browser` mapping prevents those modules from being included in browser bundles, fixing these errors.

## Verifying the browser build

We include a lightweight bundler check. This ensures browser consumers don’t accidentally pull in Node built-ins.

```bash
npm run test:webpack
```

- On broken packaging → fails.
- On correct packaging → succeeds.

## Opening a Pull Request

- Make sure `npm run build` and `npm test` all pass.
- Document changes clearly in your PR description.
