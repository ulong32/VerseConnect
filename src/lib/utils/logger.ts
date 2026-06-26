import { dev } from "$app/environment";

export interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  withSource: (source: string) => Logger;
}

const createLogger = (source?: string): Logger => {
  const prefix = source ? `[${source}]` : "";
  return {
    log: (...args: any[]) => {
      if (dev) {
        if (prefix) console.log(prefix, ...args);
        else console.log(...args);
      }
    },
    error: (...args: any[]) => {
      if (dev) {
        if (prefix) console.error(prefix, ...args);
        else console.error(...args);
      }
    },
    warn: (...args: any[]) => {
      if (dev) {
        if (prefix) console.warn(prefix, ...args);
        else console.warn(...args);
      }
    },
    info: (...args: any[]) => {
      if (dev) {
        if (prefix) console.info(prefix, ...args);
        else console.info(...args);
      }
    },
    debug: (...args: any[]) => {
      if (dev) {
        if (prefix) console.debug(prefix, ...args);
        else console.debug(...args);
      }
    },
    withSource: (newSource: string) => {
      return createLogger(source ? `${source}/${newSource}` : newSource);
    },
  };
};

export const logger = createLogger();
