export type Point = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cheap lat/lng box used to pre-filter database rows before exact distance checks. */
export function boundingBox(p: Point, meters: number) {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.01, Math.cos(rad(p.lat))));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

/** Mean position; accurate enough for points a few hundred metres apart. */
export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

/** Move a point east/north by metres (used by the demo-data seed). */
export function offsetPoint(origin: Point, eastM: number, northM: number): Point {
  return {
    lat: origin.lat + northM / 111_320,
    lng: origin.lng + eastM / (111_320 * Math.cos(rad(origin.lat))),
  };
}