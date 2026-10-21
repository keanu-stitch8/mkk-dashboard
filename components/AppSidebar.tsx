"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "@/components/app-nav";
import { MkkLogo } from "@/components/MkkLogo";

// Layout sidebar mengikuti shadcnstore dashboard template (variant inset, offcanvas, grup + sub-menu yang bisa dilipat lewat panah).
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const m = params.get("m");
  const withMonth = (href: string) => (m ? `${href}?m=${m}` : href);
  const close = () => setOpenMobile(false);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={withMonth("/")} onClick={close}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-white">
                  <MkkLogo className="size-6" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">MKK Analytics</span>
                  <span className="truncate text-xs">Main ke Kudus</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.items?.length ? (
                  <Collapsible key={item.title} asChild defaultOpen={pathname.startsWith(item.url)} className="group/collapsible">
                    <SidebarMenuItem>
                      {/* teks → halaman utama channel; panah (SidebarMenuAction) → lipat/buka sub-menu */}
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                        <Link href={withMonth(item.url)} onClick={close}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="cursor-pointer transition-transform duration-200 data-[state=open]:rotate-90">
                          <ChevronRight />
                          <span className="sr-only">Buka/tutup {item.title}</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((sub) => (
                            <SidebarMenuSubItem key={sub.url}>
                              <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                                <Link href={withMonth(sub.url)} onClick={close}>
                                  <span>{sub.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)}>
                      <Link href={withMonth(item.url)} onClick={close}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
