import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MKK Analytics",
  description: "Dashboard analytics bulanan Main ke Kudus",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      {/* suppressHydrationWarning: ekstensi browser (mis. ColorZilla: cz-shortcut-listen) menambah atribut ke <body> sebelum hydrate */}
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            <SidebarProvider defaultOpen={sidebarOpen}>
              <Suspense>
                <AppSidebar />
              </Suspense>
              <SidebarInset className="min-w-0">
                <header className="no-print sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
                  <span className="text-sm font-medium text-muted-foreground">Main ke Kudus · Analytics</span>
                  <div className="ml-auto">
                    <ThemeToggle />
                  </div>
                </header>
                <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
