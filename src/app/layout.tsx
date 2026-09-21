import "./globals.css";
import type { Metadata } from "next";

import { mono, serif } from "@/lib/fonts";

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
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
