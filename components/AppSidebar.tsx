"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChartNoAxesCombined, Globe, LayoutDashboard, Newspaper, MessagesSquare, Upload, FileText, Cable, FileSpreadsheet } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { href: string; label: string; icon: React.ComponentType; sub?: { href: string; label: string }[] };

const CHANNELS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/website", label: "Website", icon: Globe },
  { href: "/news", label: "News", icon: Newspaper, sub: [{ href: "/news/logs", label: "Publishing Log" }] },
  { href: "/youtube", label: "YouTube", icon: SiYoutube, sub: [{ href: "/youtube/logs", label: "Publishing Log" }] },
  { href: "/social", label: "Social Media", icon: MessagesSquare, sub: [{ href: "/social/logs", label: "Publishing Log" }] },
];

const TOOLS: NavItem[] = [
  { href: "/import", label: "Import Data", icon: Upload },
  { href: "/report", label: "Report / PDF", icon: FileText },
  { href: "/settings/connectors", label: "Connectors API", icon: Cable },
  { href: "/logs", label: "Sumber Logs", icon: FileSpreadsheet },
];

export function AppSidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const m = params.get("m");
  const withMonth = (href: string) => (m ? `${href}?m=${m}` : href);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive(item.href) && !item.sub?.some((s) => pathname.startsWith(s.href))} tooltip={item.label}>
          <Link href={withMonth(item.href)} onClick={() => setOpenMobile(false)}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {item.sub && (
          <SidebarMenuSub>
            {item.sub.map((s) => (
              <SidebarMenuSubItem key={s.href}>
                <SidebarMenuSubButton asChild isActive={pathname === s.href}>
                  <Link href={withMonth(s.href)} onClick={() => setOpenMobile(false)}>
                    <span>{s.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        )}
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
