// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_TITLE } from "../constants.mjs";

export function createLogger() {
  return Object.freeze({
    debug: (...args) => console.debug(`${MODULE_TITLE} |`, ...args),
    info: (...args) => console.info(`${MODULE_TITLE} |`, ...args),
    warn: (...args) => console.warn(`${MODULE_TITLE} |`, ...args),
    error: (...args) => console.error(`${MODULE_TITLE} |`, ...args),
  });
}
