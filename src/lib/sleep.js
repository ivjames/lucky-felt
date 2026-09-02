/** Resolve after `ms` milliseconds. Used to pace the win/lose reveal animations. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
