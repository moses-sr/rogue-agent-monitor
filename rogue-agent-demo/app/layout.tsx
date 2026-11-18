import type { Metadata } from "next";
import { Archivo, Courier_Prime } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Spot the rogue agent",
  description:
    "Rogue agents of rising sneakiness against monitors of rising skill, on a shared ledger.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${courier.variable}`}>
      <body>{children}</body>
    </html>
  );
}
