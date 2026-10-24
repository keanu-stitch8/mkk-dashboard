"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NAV_GROUPS } from "@/components/app-nav";

/** Pencarian halaman (⌘K / Ctrl+K) — bulan yang dipilih (?m=) ikut dibawa. */
function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const m = useSearchParams().get("m");
  const go = (url: string) => {
    onOpenChange(false);
    router.push(m ? `${url}?m=${m}` : url);
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search pages"
      description="Jump to a dashboard page"
    >
      <Command>
        <CommandInput placeholder="Search pages…" />
        <CommandList>
          <CommandEmpty>No matching pages.</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.flatMap((item) =>
                [item, ...(item.items ?? [])].map((link) => (
                  <CommandItem
                    key={link.url}
                    value={`${item.title} ${link.title}`}
                    onSelect={() => go(link.url)}
                  >
                    <item.icon />
                    <span>
                      {link === item
                        ? item.title
                        : `${item.title} · ${link.title}`}
                    </span>
                  </CommandItem>
                )),
              )}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

// Header mengikuti shadcnstore dashboard template: trigger sidebar, pencarian ⌘K, toggle tema.
export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <header className="no-print flex h-(--header-height) shrink-0 items-center gap-2 border-b">
        <div className="flex w-full items-center gap-1 px-4 py-3 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <div className="max-w-sm flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="relative w-full justify-start font-normal text-muted-foreground sm:pr-12 md:w-36 lg:w-56"
            >
              <Search />
              Search…
              <Kbd className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 sm:inline-flex">
                ⌘K
              </Kbd>
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
