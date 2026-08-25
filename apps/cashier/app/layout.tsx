import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VALEX — Consola de Caja",
  description: "Consola de operaciones de caja y ventanilla VALEX",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
