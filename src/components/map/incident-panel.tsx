import { X } from "lucide-react";
import { Badge, severityTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLUSTER_CONFIG as C } from "@/lib/clustering/config";
import type { MapComplaint, MapIncident } from "@/lib/map-data";
import { categoryLabel, label } from "@/lib/utils";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function SimulatedBadge() {
  return <Badge tone="warning">Simulated demo data</Badge>;
}

export function IncidentDetail({ incident: i, onClose }: { incident: MapIncident; onClose: () => void }) {
  return (
    <section aria-label="Incident details" className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{i.title}</h2>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close details"><X className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{categoryLabel(i.category)}</Badge>
        <Badge tone={severityTone(i.severity)}>{label(i.severity)}</Badge>
        <Badge tone="info">{label(i.status)}</Badge>
        {i.isDemo && <SimulatedBadge />}
      </div>
      <dl className="mt-3 grid grid-cols-[8.5rem_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Locality</dt><dd>{i.address ?? "Not provided"}</dd>
        <dt className="text-muted-foreground">Supporting reports</dt><dd className="font-semibold">{i.reportCount}</dd>
        <dt className="text-muted-foreground">First reported</dt><dd>{fmt(i.firstReportedAt)}</dd>
        <dt className="text-muted-foreground">Latest report</dt><dd>{fmt(i.latestReportedAt)}</dd>
      </dl>

      <h3 className="mt-3 text-sm font-semibold">Why this severity</h3>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">{i.severityReasons.map((r) => <li key={r}>{r}</li>)}</ul>

      <h3 className="mt-3 text-sm font-semibold">Why these reports were grouped</h3>
      <p className="text-sm text-muted-foreground">
        Same category, within {C.radiusMeters} m of the incident centre, reported within {C.windowDays} days,
        and text similarity of at least {C.minTextSimilarity}. Original complaints are never changed or hidden.
      </p>

      <h3 className="mt-3 text-sm font-semibold">Linked complaints ({i.members.length})</h3>
      <ul className="mt-1 max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
        {i.members.map((m) => (
          <li key={m.id} className="p-2.5">
            <p>{m.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(m.createdAt)} · {m.distanceM} m from centre · similarity {m.textScore.toFixed(2)}
              {m.severity ? ` · ${label(m.severity)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ComplaintDetail({
  complaint: c, onClose, onOpenIncident,
}: { complaint: MapComplaint; onClose: () => void; onOpenIncident: (id: string) => void }) {
  return (
    <section aria-label="Complaint details" className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">Complaint</h2>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close details"><X className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{categoryLabel(c.category)}</Badge>
        {c.severity && <Badge tone={severityTone(c.severity)}>{label(c.severity)}</Badge>}
        {c.isDemo && <SimulatedBadge />}
      </div>
      <p className="mt-3 text-sm">{c.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{c.address ?? "No locality given"} · {fmt(c.createdAt)}</p>
      {c.incidentId ? (
        <Button className="mt-3" size="sm" variant="outline" onClick={() => onOpenIncident(c.incidentId!)}>View its community incident</Button>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Not linked to an incident (not enough related reports nearby yet).</p>
      )}
    </section>
  );
}