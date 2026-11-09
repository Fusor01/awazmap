import { getAdminData } from "@/lib/queries";
import { DbError, RecentComplaints } from "@/components/admin/panels";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const d = await getAdminData();
  if (!d.ok) return <DbError />;
  return (
    <>
      <h1 className="text-2xl font-bold">Complaints</h1>
      <RecentComplaints d={d} />
    </>
  );
}