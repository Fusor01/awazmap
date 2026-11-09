import { getAdminData } from "@/lib/queries";
import { DbError, IncidentTable } from "@/components/admin/panels";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const d = await getAdminData();
  if (!d.ok) return <DbError />;
  return (
    <>
      <h1 className="text-2xl font-bold">Incidents</h1>
      <IncidentTable d={d} />
    </>
  );
}