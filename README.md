# Kite: the modern TypeScript client for Solana Kit 🪁

Kite uses smart defaults that require less code than every other Solana client, including Foundation Kit, Gill and web3.js.

[![Tests](https://github.com/solanakite/kite/actions/workflows/tests.yaml/badge.svg)](https://github.com/solanakite/kite/actions/workflows/tests.yaml)

## Features

- **Write half the code of alternatives** - Clean, intuitive APIs mean less boilerplate and fewer bugs in your production apps
- **Ship faster with single-line operations** - Create funded wallets, send tokens, create tokens, and make arbitrary transactions without the boilerplate of lower-level clients
- **5 example projects and 6+ video tutorials and hand written editor docs** show you how to build production-ready Solana apps
- **Never get locked in** - Built on Solana Kit with identical types, so you can drop down to `connection.rpc` whenever you need full control
- **Use as a plugin** - Kite 3.0+ implements the Solana Kit plugin pattern, making it composable with other plugins while maintaining the simple convenience API

## Quick Start

```typescript
import { connect } from 'solana-kite';

const connection = connect('devnet');
const wallet = await connection.createWallet();
```

## Plugin Usage (New in 3.0)

Kite can now be used as a Solana Kit plugin, allowing composition with other plugins:

```typescript
import { createSolanaRpc, createDefaultRpcTransport } from '@solana/kit';
import { createKitePlugin } from 'solana-kite';

const transport = createDefaultRpcTransport({ url: 'https://api.devnet.solana.com' });
const rpc = createSolanaRpc(transport);
const connection = rpc.use(createKitePlugin({ clusterNameOrURL: 'devnet' }));
```

Both approaches provide the same functionality. The `connect()` convenience function is a drop-in replacement for Kite 2.x projects.

[Solana Kite website](https://solanakite.org)

[Documentation](https://solanakite.org/docs)

[npm](https://www.npmjs.com/package/solana-kite)

[GitHub](https://github.com/solanakite/kite)

[Example Projects](https://solanakite.org/docs/examples)

[Videos](https://solanakite.org/docs/videos)

[Kite on Solana Stack Exchange](https://solana.stackexchange.com/search?q=kite)

[Changelog](https://solanakite.org/docs/changelog)
