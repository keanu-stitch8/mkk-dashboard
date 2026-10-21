import { Cable, FileSpreadsheet, FileText, Globe, LayoutDashboard, MessagesSquare, Newspaper, Upload } from "lucide-react";
import { SiYoutube } from "./icons";

export type NavLink = { title: string; url: string };
export type NavItem = NavLink & { icon: React.ComponentType<{ className?: string }>; items?: NavLink[] };

/** Navigasi utama (sidebar & pencarian ⌘K). Item dengan `items`: teks → halaman `url`, panah → lipat/buka sub-menu. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Channel",
    items: [
      { title: "Overview", url: "/", icon: LayoutDashboard },
      { title: "Website", url: "/website", icon: Globe },
      {
        title: "News",
        url: "/news",
        icon: Newspaper,
        items: [{ title: "Publishing Log", url: "/news/logs" }],
      },
      {
        title: "Social Media",
        url: "/social",
        icon: MessagesSquare,
        items: [{ title: "Publishing Log", url: "/social/logs" }],
      },
      {
        title: "YouTube",
        url: "/youtube",
        icon: SiYoutube,
        items: [{ title: "Publishing Log", url: "/youtube/logs" }],
      },
    ],
  },
  {
    label: "Data",
    items: [
      { title: "Import Data", url: "/import", icon: Upload },
      { title: "Report / PDF", url: "/report", icon: FileText },
      { title: "Connectors API", url: "/settings/connectors", icon: Cable },
      { title: "Source Logs", url: "/logs", icon: FileSpreadsheet },
    ],
  },
];
