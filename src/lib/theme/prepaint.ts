/**
 * Light mode's storage key and the script that applies the saved theme before
 * the first paint. Kept apart from light.ts, which uses React hooks, so the
 * (server) root layout can import it.
 */
export const BEND_KEY = "avi-site:bend";

/** Runs in <head>: the saved bend (or the system's preference) picks the theme, as light.ts does. */
export const PREPAINT = `try{var b=localStorage.getItem("${BEND_KEY}");b=b===null?(matchMedia("(prefers-color-scheme: light)").matches?1:0):+b||0;document.documentElement.dataset.theme=b>=.5?"light":"dark"}catch(e){}`;
