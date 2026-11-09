import Link from "next/link";
import { AlertTriangle, ArrowRight, Inbox, MapPinned, MessageSquareText, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, severityTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { categoryLabel, cn, label, timeAgo } from "@/lib/utils";
import type { getAdminData, SourceFilter } from "@/lib/queries";

type Data = Extract<Awaited<ReturnType<typeof getAdminData>>, { ok: true }>;

export function DbError() {
  return (
    <Card>
      <CardContent role="alert" className="p-6 text-sm text-destructive">
        Couldn't reach the database. Check DATABASE_URL, then open /api/health.
      </CardContent>
    </Card>
  );
}

const SOURCES: { value: SourceFilter; text: string }[] = [
  { value: "ALL", text: "All data" },
  { value: "REAL", text: "Real reports" },
  { value: "DEMO", text: "Simulated demo" },
];

export function SourceFilterLinks({ current }: { current: SourceFilter }) {
  return (
    <nav aria-label="Data source" className="flex rounded-md border bg-card p-1 text-sm">
      {SOURCES.map((s) => (
        <Link
          key={s.value}
          href={s.value === "ALL" ? "/admin" : `/admin?data=${s.value}`}
          aria-current={current === s.value ? "page" : undefined}
          className={cn("rounded px-3 py-1.5 font-medium", current === s.value ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {s.text}
        </Link>
      ))}
    </nav>
  );
}

export function StatCards({ d }: { d: Data }) {
  const stats = [
    { name: "Total complaints", value: d.totalComplaints, hint: `${d.newComplaints} new`, icon: MessageSquareText },
    { name: "Unresolved complaints", value: d.unresolvedComplaints, hint: "Not yet resolved", icon: Inbox },
    { name: "Active community incidents", value: d.activeIncidents, hint: `${d.resolvedIncidents} resolved`, icon: AlertTriangle },
    { name: "High-priority complaints", value: d.highPriority, hint: "High or critical, unresolved", icon: ShieldAlert },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map(({ name, value, hint, icon: Icon }) => (
        <Card key={name}>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">{name}</p>
              <p className="text-3xl font-bold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
            <Icon className="h-6 w-6 text-accent" aria-hidden />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Bars({ rows, empty }: { rows: { name: string; count: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="font-semibold tabular-nums">{r.count}</span>
          </div>
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CategoryBreakdown({ d }: { d: Data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Most reported categories</CardTitle></CardHeader>
      <CardContent>
        <Bars rows={d.categories.map((c) => ({ name: categoryLabel(c.category), count: c.count }))} empty="No complaints yet." />
      </CardContent>
    </Card>
  );
}

export function LocalityBreakdown({ d }: { d: Data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locality-wise distribution</CardTitle>
        <CardDescription>Top localities by number of complaints, as typed by citizens.</CardDescription>
      </CardHeader>
      <CardContent><Bars rows={d.localities} empty="No locality information yet." /></CardContent>
    </Card>
  );
}

export function RecentComplaints({ d }: { d: Data }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent complaints</CardTitle></CardHeader>
      <CardContent>
        {d.recentComplaints.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No complaints yet. Submit one from the <Link href="/report" className="font-medium text-accent underline">citizen page</Link>.
          </p>
        ) : (
          <ul className="divide-y">
            {d.recentComplaints.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-3">
                <p className="line-clamp-2 text-sm">{c.summary ?? c.transcript}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge>{categoryLabel(c.category)}</Badge>
                  {c.severity && <Badge tone={severityTone(c.severity)}>{label(c.severity)}</Badge>}
                  <Badge tone={c.status === "NEW" ? "info" : "success"}>{label(c.status)}</Badge>
                  {c.isDemo && <Badge tone="warning">Simulated</Badge>}
                  <span>{c.address ?? "No locality"} · {timeAgo(c.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function IncidentTable({ d }: { d: Data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community incidents</CardTitle>
        <CardDescription>Groups of related complaints. Open the map for linked reports.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {d.incidents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No incidents yet. One forms when several related complaints are reported close together.
          </p>
        ) : (
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Incident</th><th>Category</th><th>Severity</th><th>Status</th><th>Reports</th></tr>
            </thead>
            <tbody className="divide-y">
              {d.incidents.map((i) => (
                <tr key={i.id}>
                  <td className="py-2.5 font-medium">{i.title} {i.isDemo && <Badge tone="warning">Simulated</Badge>}</td>
                  <td>{categoryLabel(i.category)}</td>
                  <td><Badge tone={severityTone(i.severity)}>{label(i.severity)}</Badge></td>
                  <td>{label(i.status)}</td>
                  <td className="tabular-nums">{i.reportCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function MapCta() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <MapPinned className="h-6 w-6 text-accent" aria-hidden />
          <div>
            <p className="font-semibold">Community Signal map</p>
            <p className="text-sm text-muted-foreground">See complaints and community incidents on the map, with filters and linked reports.</p>
          </div>
        </div>
        <Link href="/admin/map" className={cn(buttonVariants({ variant: "accent" }))}>
          Open map <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}