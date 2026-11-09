import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Badge, severityTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { categoryLabel, label } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved report — AwaazMap" };

export default async function SavedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.complaint.findUnique({ where: { id } }).catch(() => null);
  if (!c) notFound();

  const rows: [string, React.ReactNode][] = [
    ["Category", categoryLabel(c.category)],
    ["Priority", c.severity ? <Badge tone={severityTone(c.severity)}>{label(c.severity)}</Badge> : "—"],
    ["Duration", c.durationText ?? "Not stated"],
    ["Reported before", c.previousComplaint === null ? "Not stated" : c.previousComplaint ? "Yes" : "No"],
    ["Landmark / locality", c.address ?? "Not provided"],
    ["Coordinates", c.latitude !== null ? `${c.latitude.toFixed(5)}, ${c.longitude?.toFixed(5)}` : "—"],
    ["Language", c.language ?? "—"],
    ["Status", label(c.status)],
  ];

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-2"><Logo /><h1 className="text-2xl font-bold">Your saved report</h1></header>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent><p>{c.summary}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{c.source === "VOICE" ? "Original transcript" : "Original text"}</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap rounded-md bg-muted p-3">{c.transcript}</p></CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>))}
            </dl>
            {c.severityReasons.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">{c.severityReasons.map((r) => <li key={r}>{r}</li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Link href="/report" className="text-sm font-medium text-accent underline">Submit another report</Link>
      </div>
    </main>
  );
}
