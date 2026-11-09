import { DbError } from "@/components/admin/panels";
import { MapView } from "@/components/map/map-view";
import { getMapData } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const data = await getMapData();
  if (!data.ok) return <DbError />;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Community Signal map</h1>
        <p className="text-sm text-muted-foreground">
          Related complaints are grouped into incidents by category, distance, time and text similarity. Map data © OpenStreetMap contributors.
        </p>
      </div>
      <MapView complaints={data.complaints} incidents={data.incidents} />
    </>
  );
}