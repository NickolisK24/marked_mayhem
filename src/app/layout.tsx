import type { Metadata, Viewport } from "next";
import { EVENT_NAME } from "@/config/event";
import "./globals.css";

export const metadata: Metadata = {
  title: `${EVENT_NAME} — live standings`,
  description:
    "Live team and player standings for the Marked Mayhem drop competition.",
  openGraph: {
    title: `${EVENT_NAME} — live standings`,
    description:
      "Live team and player standings for the Marked Mayhem drop competition.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
