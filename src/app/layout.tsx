// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AlWeather",
  description: "Clean, fast weather for Alabama.",
};

// ✅ critical for iOS notch/safe areas & proper scaling
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* ✅ prevent accidental horizontal scroll/bleed on iOS */}
      <body className="antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
