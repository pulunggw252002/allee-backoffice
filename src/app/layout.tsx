import type { Metadata } from "next";
import { Geist_Mono, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/providers";
import { config } from "@/lib/config";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: config.app.name,
  description: `Control center untuk manajemen menu, inventaris, staff, dan laporan bisnis ${config.app.shortName}.`,
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={config.locale.lang} suppressHydrationWarning>
      <body
        className={`${geistMono.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
