import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence — Free Microsoft Neural Text to Speech Studio",
  description:
    "Turn any script into natural narration with the free Microsoft Edge / Azure neural voices. 300+ voices, word-level timing, MP3 download, and saved clips.",
  keywords: ["text to speech", "tts", "microsoft edge voices", "azure neural voices", "mp3", "voiceover"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-950 text-mist-50 antialiased">{children}</body>
    </html>
  );
}
