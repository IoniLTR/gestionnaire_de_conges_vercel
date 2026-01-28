import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Modak } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

const modak = Modak({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-modak",
});

export const metadata: Metadata = {
  title: "Ze-Gestion Congés",
  description: "Application de gestion des temps de travail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${modak.variable} antialiased bg-[#f0f2f8] min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
