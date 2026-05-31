import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian AI - Camera Intelligence Console",
  description: "Privacy-first CCTV incident intelligence dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
