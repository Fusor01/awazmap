"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, severityTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import type { MapComplaint, MapIncident } from "@/lib/map-data";
import { CATEGORIES, CATEGORY_LABELS, categoryLabel, label } from "@/lib/utils";
import { CLUSTER_CONFIG as C } from "@/lib/clustering/config";
import { ComplaintDetail, IncidentDetail, SimulatedBadge } from "./incident-panel";
import { SEVERITY_COLOR, type Bounds, type Focus } from "./leaflet-map";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>,
});

type Selection = { type: "incident" | "complaint"; id: string } | null;

export function MapView({ complaints: allComplaints, incidents: allIncidents }: { complaints: MapComplaint[]; incidents: MapIncident[] }) {
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [source, setSource] = useState<"ALL" | "REAL" | "DEMO">("ALL");
  const [viewOnly, setViewOnly] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [fitNonce, setFitNonce] = useState(0);

  const keep = (cat: string, sev: string | null, demo: boolean) =>
    (category === "ALL" || cat === category) &&
    (severity === "ALL" || (sev ?? "LOW") === severity) &&
    (source === "ALL" || (source === "DEMO") === demo);

  const complaints = useMemo(
    () => allComplaints.filter((c) => keep(c.category, c.severity, c.isDemo)),
    [allComplaints, category, severity, source] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const incidents = useMemo(
    () => allIncidents.filter((i) => keep(i.category, i.severity, i.isDemo)),
    [allIncidents, category, severity, source] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const inView = (lat: number, lng: number) =>
    !viewOnly || !bounds || (lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east);
  const listIncidents = incidents.filter((i) => inView(i.lat, i.lng)).sort((a, b) => b.reportCount - a.reportCount);
  const complaintsInView = complaints.filter((c) => inView(c.lat, c.lng)).length;
  const allPoints = useMemo(
    () => [...allComplaints.map((c) => [c.lat, c.lng] as [number, number]), ...allIncidents.map((i) => [i.lat, i.lng] as [number, number])],
    [allComplaints, allIncidents]
  );

  const selIncident = selected?.type === "incident" ? allIncidents.find((i) => i.id === selected.id) : undefined;
  const selComplaint = selected?.type === "complaint" ? allComplaints.find((c) => c.id === selected.id) : undefined;

  function openIncident(id: string) {
    const inc = allIncidents.find((i) => i.id === id);
    setSelected({ type: "incident", id });
    if (inc) setFocus({ lat: inc.lat, lng: inc.lng, nonce: Date.now() });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="f-cat">Category</Label>
              <Select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="ALL">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-sev">Severity</Label>
              <Select id="f-sev" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="ALL">All severities</option>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-src">Data</Label>
              <Select id="f-src" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
                <option value="ALL">Real + simulated</option>
                <option value="REAL">Real reports only</option>
                <option value="DEMO">Simulated demo only</option>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
                Only what's in the map view
              </label>
              <Button type="button" size="sm" variant="outline" onClick={() => setFitNonce((n) => n + 1)}>Fit map to all data</Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative isolate h-[60vh] min-h-[360px] overflow-hidden rounded-lg border">
          <LeafletMap
            complaints={complaints}
            incidents={incidents}
            allPoints={allPoints}
            selected={selected}
            focus={focus}
            fitNonce={fitNonce}
            onSelect={(s) => setSelected(s)}
            onBoundsChange={setBounds}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map legend">
          {Object.entries(SEVERITY_COLOR).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: v }} />{label(k)}</span>
          ))}
          <span>Numbered circle = community incident (reports)</span>
          <span>Dashed ring = {C.radiusMeters} m incident area</span>
          <span>Faded dot = complaint linked to an incident · solid dot = standalone</span>
        </div>
      </div>

      <aside className="flex flex-col gap-3" aria-label="Incidents and details">
        {selIncident && <IncidentDetail incident={selIncident} onClose={() => setSelected(null)} />}
        {selComplaint && <ComplaintDetail complaint={selComplaint} onClose={() => setSelected(null)} onOpenIncident={openIncident} />}

        <Card>
          <CardContent className="p-4">
            <h2 className="text-base font-semibold">Community incidents</h2>
            <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
              {listIncidents.length} incident{listIncidents.length === 1 ? "" : "s"} · {complaintsInView} complaint{complaintsInView === 1 ? "" : "s"} shown
            </p>
            {listIncidents.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No incidents match. An incident forms when {C.minReportsToForm}+ related complaints are reported nearby.
              </p>
            ) : (
              <ul className="max-h-[50vh] divide-y overflow-y-auto">
                {listIncidents.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => openIncident(i.id)}
                      aria-current={selected?.type === "incident" && selected.id === i.id}
                      className="flex w-full flex-col gap-1 py-2.5 text-left hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="grid h-7 min-w-7 place-items-center rounded-full px-1 text-xs font-bold text-white" style={{ background: SEVERITY_COLOR[i.severity] }}>{i.reportCount}</span>
                        {categoryLabel(i.category)}
                      </span>
                      <span className="text-xs text-muted-foreground">{i.address ?? "Locality not provided"}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={severityTone(i.severity)}>{label(i.severity)}</Badge>
                        {i.isDemo && <SimulatedBadge />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}