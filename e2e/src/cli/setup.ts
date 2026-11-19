// SPDX-License-Identifier: Apache-2.0
// pnpm e2e:setup --agents <a,b> [--secrets-dir <dir>]
import { setup } from '../setup.ts';
import { main, setupOptions } from './options.ts';

await main(setupOptions, setup);
