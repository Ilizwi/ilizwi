import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ILIZWI — Panashe Archival Research Platform",
  description:
    "A scholarly research platform for African-language archival newspaper materials.",
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
