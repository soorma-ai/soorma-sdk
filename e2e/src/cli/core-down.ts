// SPDX-License-Identifier: Apache-2.0
// pnpm e2e:core-down [--logs]
import { coreDown } from '../core-down.ts';
import { coreDownOptions, main } from './options.ts';

await main(coreDownOptions, coreDown);
