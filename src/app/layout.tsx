import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeScript } from "@/components/shell/theme-script";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "CREAM — the AI creator marketplace",
    template: "%s · CREAM",
  },
  description:
    "CREAM is an AI-native marketplace connecting AI filmmakers, animators and generative creators with brands and agencies. Verified portfolios, structured briefs, held payments, signed provenance.",
  keywords: [
    "AI creators",
    "generative content marketplace",
    "AI filmmaker",
    "creative brief",
    "DigiLocker",
    "Razorpay escrow",
    "SynthID",
    "C2PA provenance",
  ],
  authors: [{ name: "CREAM" }],
  openGraph: {
    title: "CREAM — the AI creator marketplace",
    description:
      "Discover, brief and pay AI creators with verification, held escrow and signed provenance on every asset.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="espresso"
      className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}