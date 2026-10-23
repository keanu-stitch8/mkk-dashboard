import { Cable, CalendarRange, ClipboardList, FileSpreadsheet, FileText, Globe, LayoutDashboard, MessagesSquare, Newspaper, NotebookPen, Trophy, Upload, UsersRound, Workflow } from "lucide-react";
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
    label: "Team",
    items: [
      { title: "Content Pipeline", url: "/team/pipeline", icon: Workflow },
      { title: "Stories", url: "/team/stories", icon: NotebookPen },
      { title: "Briefs", url: "/team/briefs", icon: ClipboardList },
      { title: "Contributors", url: "/team/contributors", icon: UsersRound },
      { title: "Team Scorecard", url: "/team/scorecard", icon: Trophy },
      { title: "2026 in Numbers", url: "/team/recap", icon: CalendarRange },
    ],
  },
  {
    label: "Data",
    items: [
      {
        title: "Import Data",
        url: "/import",
        icon: Upload,
        items: [{ title: "Import History", url: "/import/history" }],
      },
      { title: "Report / PDF", url: "/report", icon: FileText },
      {
        title: "Connectors API",
        url: "/settings/connectors",
        icon: Cable,
        items: [{ title: "Sync History", url: "/settings/connectors/history" }],
      },
      { title: "Source Logs", url: "/logs", icon: FileSpreadsheet },
    ],
  },
];
