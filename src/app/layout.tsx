import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar, BottomNav } from "@/components/nav";
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
  title: { default: "Megaapp", template: "%s · Megaapp" },
  description: "One app for your whole life.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Megaapp", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="mx-auto flex min-h-screen max-w-6xl">
          <Sidebar />
          <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
