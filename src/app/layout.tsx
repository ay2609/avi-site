import "./globals.css";
import type { Metadata } from "next";

import { mono, serif, text } from "@/lib/fonts";
import { PREPAINT } from "@/lib/theme/prepaint";

const DESCRIPTION =
  "Computer science and robotics at the University of Maryland — embedded work, and the places where software, hardware and design meet.";

/**
 * The previews' images are files beside the routes (opengraph-image.tsx, the
 * icons in this folder); metadataBase makes their URLs absolute for the
 * sites that unfurl links.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://halcyn.dev"),
  title: "Avi Yadava",
  description: DESCRIPTION,
  openGraph: { siteName: "Avi Yadava", type: "website", url: "/", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The prepaint script sets a style on <html> before React hydrates.
    <html lang="en" className={`${serif.variable} ${text.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
