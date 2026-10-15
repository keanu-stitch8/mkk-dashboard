"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChartNoAxesCombined, Globe, LayoutDashboard, Newspaper, MessagesSquare, Upload, FileText } from "lucide-react";
import { SiYoutube } from "./icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const CHANNELS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/website", label: "Website", icon: Globe },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/youtube", label: "YouTube", icon: SiYoutube },
  { href: "/social", label: "Social Media", icon: MessagesSquare },
];

const TOOLS = [
  { href: "/import", label: "Import Data", icon: Upload },
  { href: "/report", label: "Report / PDF", icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const m = params.get("m");
  const withMonth = (href: string) => (m ? `${href}?m=${m}` : href);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderItems = (items: typeof CHANNELS) =>
    items.map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
          <Link href={withMonth(item.href)} onClick={() => setOpenMobile(false)}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={withMonth("/")}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ChartNoAxesCombined className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">MKK Analytics</span>
                  <span className="truncate text-xs text-muted-foreground">Main ke Kudus</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Channel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(CHANNELS)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(TOOLS)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 text-[11px] leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">Laporan bulanan Website · News · YouTube · Social</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
