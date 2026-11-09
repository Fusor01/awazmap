import Link from "next/link";
import { Logo } from "@/components/logo";

const links = [
  { href: "/report", label: "Report a problem" },
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/map", label: "Map" },
];

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Logo />
      <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm font-medium">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 hover:bg-muted">{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}