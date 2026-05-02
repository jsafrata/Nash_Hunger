import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nash Hunger",
  description:
    "A 4-player real-time market survival game. Trade or starve.",
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
