import { getAdminData, parseSource } from "@/lib/queries";
import {
  CategoryBreakdown, DbError, IncidentTable, LocalityBreakdown, MapCta, RecentComplaints, SourceFilterLinks, StatCards,
} from "@/components/admin/panels";

export const dynamic = "force-dynamic";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const source = parseSource((await searchParams).data);
  const d = await getAdminData(source);
  if (!d.ok) return <DbError />;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Civic intelligence dashboard</h1>
          <p className="text-sm text-muted-foreground">What citizens are reporting, and where it adds up to a community problem.</p>
        </div>
        <SourceFilterLinks current={source} />
      </div>
      <StatCards d={d} />
      <div className="grid gap-5 xl:grid-cols-2"><CategoryBreakdown d={d} /><LocalityBreakdown d={d} /></div>
      <div className="grid gap-5 xl:grid-cols-2"><RecentComplaints d={d} /><IncidentTable d={d} /></div>
      <MapCta />
    </>
  );
}