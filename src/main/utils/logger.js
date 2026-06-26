import { app } from "electron";

const isDev = !app.isPackaged;

/**
 * @typedef {Object} Logger
 * @property {(...args: any[]) => void} log
 * @property {(...args: any[]) => void} error
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} info
 * @property {(...args: any[]) => void} debug
 * @property {(source: string) => Logger} withSource
 */

/**
 * @param {string} [source]
 * @returns {Logger}
 */
const createLogger = (source) => {
  const prefix = source ? `[${source}]` : "";
  return {
    log: (...args) => {
      if (isDev) {
        if (prefix) console.log(prefix, ...args);
        else console.log(...args);
      }
    },
    error: (...args) => {
      if (isDev) {
        if (prefix) console.error(prefix, ...args);
        else console.error(...args);
      }
    },
    warn: (...args) => {
      if (isDev) {
        if (prefix) console.warn(prefix, ...args);
        else console.warn(...args);
      }
    },
    info: (...args) => {
      if (isDev) {
        if (prefix) console.info(prefix, ...args);
        else console.info(...args);
      }
    },
    debug: (...args) => {
      if (isDev) {
        if (prefix) console.debug(prefix, ...args);
        else console.debug(...args);
      }
    },
    withSource: (newSource) => {
      return createLogger(source ? `${source}/${newSource}` : newSource);
    },
  };
};

/** @type {Logger} */
export const logger = createLogger();
