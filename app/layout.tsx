import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CustomCursor from "@/components/ui/CustomCursor";
import FullscreenButton from "@/components/ui/FullscreenButton";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PitchLens — One Match. Three Realities.",
  description: "An immersive cinematic football experience. See the game through three perspectives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full w-full overflow-hidden bg-black antialiased">
        <CustomCursor />
        <FullscreenButton />
        {children}
      </body>
    </html>
  );
}
