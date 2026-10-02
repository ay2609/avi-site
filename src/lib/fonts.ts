import { IBM_Plex_Mono, Instrument_Serif, Newsreader } from "next/font/google";

/** Masthead, headlines and the contact address. Titles only — too tall to read in. */
export const serif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-serif",
});

/** Body copy and captions: a text serif cut for reading news on screens. */
export const text = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-text",
});

/** Every label, rule-line and piece of furniture on the page. */
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["300"],
  variable: "--font-mono",
});
