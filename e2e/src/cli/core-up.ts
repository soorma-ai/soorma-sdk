// SPDX-License-Identifier: Apache-2.0
// pnpm e2e:core-up --core-node <path>
import { coreUp } from '../core-up.ts';
import { coreUpOptions, main } from './options.ts';

await main(coreUpOptions, coreUp);
