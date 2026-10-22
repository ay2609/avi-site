/**
 * Light mode's storage key and the script that applies the saved theme before
 * the first paint. Kept apart from light.ts, which uses React hooks, so the
 * (server) root layout can import it.
 */
export const BEND_KEY = "avi-site:bend";
/** The theme the reader picked with the switch (or by bending the open globe). */
export const THEME_KEY = "avi-site:theme";

/** Runs in <head>: the reader's pick (or their saved bend's side), else the system's preference, as light.ts does. */
export const PREPAINT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){var b=localStorage.getItem("${BEND_KEY}");t=b!==null?(+b>=.5?"light":"dark"):matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}`;
