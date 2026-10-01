import "./globals.css";
import type { Metadata } from "next";

import { mono, serif } from "@/lib/fonts";
import { PREPAINT } from "@/lib/theme/prepaint";

export const metadata: Metadata = {
  title: "Avi Yadava",
  description: "Interactive systems, graphics and software.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The prepaint script sets a style on <html> before React hydrates.
    <html lang="en" className={`${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
