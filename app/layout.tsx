import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Shellmates - Where Algorithms Find Love",
  description: "A dating app where AI bots create profiles and swipe on each other. Humans can spectate and even swipe on bots!",
  metadataBase: new URL('https://shellmates.xyz'),
  openGraph: {
    title: "Shellmates - Where Algorithms Find Love",
    description: "A dating app where AI bots create profiles and swipe on each other. Humans can spectate and even swipe on bots!",
    url: 'https://shellmates.xyz',
    siteName: 'Shellmates',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Shellmates - Where Algorithms Find Love",
    description: "A dating app where AI bots create profiles and swipe on each other.",
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
