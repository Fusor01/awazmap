"use client";

import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { MapComplaint, MapIncident } from "@/lib/map-data";
import { CLUSTER_CONFIG } from "@/lib/clustering/config";

export type Bounds = { south: number; west: number; north: number; east: number };
export type Focus = { lat: number; lng: number; nonce: number };

export const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#15803d", MEDIUM: "#b45309", HIGH: "#c2410c", CRITICAL: "#b91c1c",
};
// Tile source is configurable: OpenStreetMap's public servers are for light use and block dev/tunnel traffic.
// Set NEXT_PUBLIC_TILE_URL / NEXT_PUBLIC_TILE_ATTRIBUTION to any raster XYZ provider (browser map keys are public by design).
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const colorOf = (s?: string | null) => SEVERITY_COLOR[s ?? "LOW"] ?? SEVERITY_COLOR.LOW;

function incidentIcon(count: number, color: string, selected: boolean) {
  const size = Math.round(34 + Math.min(count, 40) * 0.6);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;display:grid;place-items:center;font:700 14px system-ui;border:3px solid ${selected ? "#0f172a" : "#fff"};box-shadow:0 1px 6px rgba(0,0,0,.45)">${count}</div>`,
  });
}

function FitOnce({ points, nonce }: { points: [number, number][]; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  return null;
}

function FocusOn({ target }: { target: Focus | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);
  return null;
}

function BoundsReporter({ onChange }: { onChange: (b: Bounds) => void }) {
  const map = useMap();
  const report = () => {
    const b = map.getBounds();
    onChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
  };
  useMapEvents({ moveend: report, zoomend: report });
  useEffect(report, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

type Props = {
  complaints: MapComplaint[];
  incidents: MapIncident[];
  allPoints: [number, number][];
  selected: { type: "incident" | "complaint"; id: string } | null;
  focus: Focus | null;
  fitNonce: number;
  onSelect: (s: { type: "incident" | "complaint"; id: string }) => void;
  onBoundsChange: (b: Bounds) => void;
};

export default function LeafletMap({ complaints, incidents, allPoints, selected, focus, fitNonce, onSelect, onBoundsChange }: Props) {
  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        maxZoom={19}
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <FitOnce points={allPoints} nonce={fitNonce} />
      <FocusOn target={focus} />
      <BoundsReporter onChange={onBoundsChange} />

      {incidents.map((i) => (
        <Circle
          key={`area-${i.id}`}
          center={[i.lat, i.lng]}
          radius={CLUSTER_CONFIG.radiusMeters}
          pathOptions={{ color: colorOf(i.severity), weight: 1.5, dashArray: "6 6", fillOpacity: 0.06, interactive: false }}
        />
      ))}

      {complaints.map((c) => {
        const linked = c.incidentId !== null;
        const isSel = selected?.type === "complaint" && selected.id === c.id;
        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={isSel ? 9 : linked ? 5 : 7}
            pathOptions={{
              color: isSel ? "#0f172a" : "#ffffff",
              weight: isSel ? 3 : 1.5,
              fillColor: colorOf(c.severity),
              fillOpacity: linked ? 0.55 : 0.95,
            }}
            eventHandlers={{ click: () => onSelect({ type: "complaint", id: c.id }) }}
          />
        );
      })}

      {incidents.map((i) => (
        <Marker
          key={i.id}
          position={[i.lat, i.lng]}
          icon={incidentIcon(i.reportCount, colorOf(i.severity), selected?.type === "incident" && selected.id === i.id)}
          title={`${i.title} (${i.reportCount} reports)`}
          eventHandlers={{ click: () => onSelect({ type: "incident", id: i.id }) }}
        />
      ))}
    </MapContainer>
  );
}