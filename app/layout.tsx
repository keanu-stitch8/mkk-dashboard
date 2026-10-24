import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// font Inter seperti shadcnstore template (lib/fonts.ts: body memakai inter.className)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MKK Analytics",
  description: "Monthly analytics dashboard for Main ke Kudus",
};

// kerangka dashboard (sidebar + header) ada di app/(dashboard)/layout.tsx; halaman login tanpa kerangka
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      {/* suppressHydrationWarning: ekstensi browser (mis. ColorZilla: cz-shortcut-listen) menambah atribut ke <body> sebelum hydrate */}
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
