import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EXIF Lens – by DaCameraGirl",
  description: "Beautiful, private, local-only EXIF metadata viewer for photographers. Drag a photo in, see every camera setting. 100% in-browser, zero uploads.",
  openGraph: {
    title: "EXIF Lens – by DaCameraGirl",
    description: "Beautiful, private, local-only EXIF metadata viewer for photographers.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EXIF Lens – by DaCameraGirl",
    description: "Beautiful, private, local-only EXIF metadata viewer for photographers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
