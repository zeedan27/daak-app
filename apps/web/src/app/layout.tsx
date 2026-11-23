import type { Metadata } from "next";
import { DM_Mono, Funnel_Display, Funnel_Sans } from "next/font/google";
import "./globals.css";

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-funnel-display",
  display: "swap",
});

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-funnel-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daak v2 — Bangladesh Civic Dispatch & Safety Command",
  description:
    "Police dispatch command deck, PostGIS safety intelligence, and Citizen safety command for Bangladesh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-type="software"
      data-radius="soft"
      data-buttons="solid"
      className={`${funnelDisplay.variable} ${funnelSans.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
