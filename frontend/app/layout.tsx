import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scarcity Exchange",
  description: "A 4-player real-time food trading survival game.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
