import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Housat AI",
  description: "AI-powered rental search",
  icons: {
    icon: "/brand/housat-mark.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
