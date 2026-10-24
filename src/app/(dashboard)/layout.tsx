import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/AppSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { currentUser } from "@/modules/auth/session";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const [store, user] = await Promise.all([cookies(), currentUser()]);
  const sidebarOpen = store.get("sidebar_state")?.value !== "false";
  return (
    // layout shadcnstore dashboard template: sidebar floating + icon, kiri; header 56px
    <SidebarProvider defaultOpen={sidebarOpen} style={{ "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}>
      <Suspense>
        <AppSidebar variant="floating" collapsible="icon" side="left" user={user?.name ?? null} />
      </Suspense>
      <SidebarInset className="min-w-0">
        <Suspense>
          <SiteHeader />
        </Suspense>
        <main className="@container/main flex min-w-0 flex-1 flex-col px-4 py-4 md:py-6 lg:px-6">{children}</main>
        <SiteFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
