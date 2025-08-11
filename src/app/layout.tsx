import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALWeather",
  description: "Get real-time weather updates, forecasts, and alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
