// SPDX-License-Identifier: Apache-2.0
// pnpm e2e:prove-stack
import { proveStack } from '../prove-stack.ts';
import { main, proveStackOptions } from './options.ts';

await main(proveStackOptions, proveStack);
