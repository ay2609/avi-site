import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

/** Masthead, headlines, work titles and the contact address. */
export const serif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-serif",
});

/** Every label, rule-line and piece of furniture on the page. */
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["300"],
  variable: "--font-mono",
});
