"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, LayoutDashboard, Map, MessageSquareText, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/complaints", label: "Complaints", icon: MessageSquareText },
  { href: "/admin/map", label: "Map", icon: Map },
  { href: "/admin/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/report", label: "Citizen view", icon: Mic },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium",
              active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}