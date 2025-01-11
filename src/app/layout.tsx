import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Layout from "@/components/layout/Layout";

export const metadata: Metadata = {
  title: "Space Bazaar | SpaceX Merchandise Marketplace",
  description: "Buy and sell SpaceX merchandise while supporting space exploration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
