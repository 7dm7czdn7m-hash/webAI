import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tutor Heavy",
  description: "Parallel math and science assistant with self-consistency verification"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-background text-foreground min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
