import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import {
  SITE_METADATA_DEFAULT_TITLE,
  SITE_METADATA_TITLE_TEMPLATE,
} from "@/lib/site";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SITE_METADATA_DEFAULT_TITLE,
    template: SITE_METADATA_TITLE_TEMPLATE,
  },
  description: "Explore public art in Waco with location-based detail pages.",
  icons: {
    icon: [{ url: "/favicon.png" }],
    apple: [{ url: "/favicon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
