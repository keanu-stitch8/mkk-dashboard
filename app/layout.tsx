import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist_Mono, Inter } from "next/font/google";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// font Inter seperti shadcnstore template (lib/fonts.ts: body memakai inter.className)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MKK Analytics",
  description: "Monthly analytics dashboard for Main ke Kudus",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      {/* suppressHydrationWarning: ekstensi browser (mis. ColorZilla: cz-shortcut-listen) menambah atribut ke <body> sebelum hydrate */}
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            {/* layout shadcnstore dashboard template: sidebar floating + icon, kiri; header 56px */}
            <SidebarProvider defaultOpen={sidebarOpen} style={{ "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}>
              <Suspense>
                <AppSidebar variant="floating" collapsible="icon" side="left" />
              </Suspense>
              <SidebarInset className="min-w-0">
                <Suspense>
                  <SiteHeader />
                </Suspense>
                <main className="@container/main flex min-w-0 flex-1 flex-col px-4 py-4 md:py-6 lg:px-6">{children}</main>
                <SiteFooter />
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
