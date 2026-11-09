import { ReportForm } from "@/components/report/report-form";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Report a problem — AwaazMap" };

export default function ReportPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 pb-10">
        <h1 className="mb-5 text-2xl font-bold">Report a civic problem</h1>
        <ReportForm />
      </main>
    </>
  );
}