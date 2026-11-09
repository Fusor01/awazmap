import Link from "next/link";
import { LayoutDashboard, ListChecks, MapPinned, Mic } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  { icon: Mic, title: "1. Speak", text: "Record your complaint in Hindi or English. Your words become a transcript." },
  { icon: ListChecks, title: "2. Review", text: "AI fills in the category, duration and priority. You check it, correct it and confirm your location." },
  { icon: MapPinned, title: "3. Community Signal", text: "Related reports nearby are grouped into one community incident, so officials see patterns, not isolated complaints." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5">
        <section className="flex flex-col items-center gap-6 py-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Every Voice. A Better City.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Speak your civic complaint. AwaazMap turns it into a structured report and shows what your community is facing on a live map.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/report" className={cn(buttonVariants({ variant: "accent", size: "lg" }))}>
              <Mic className="h-5 w-5" aria-hidden /> Report a problem
            </Link>
            <Link href="/admin/map" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              <MapPinned className="h-5 w-5" aria-hidden /> View the live map
            </Link>
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              <LayoutDashboard className="h-5 w-5" aria-hidden /> Dashboard
            </Link>
          </div>
        </section>
        <section aria-labelledby="how" className="pb-16">
          <h2 id="how" className="mb-4 text-center text-xl font-semibold">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-lg border bg-card p-5">
                <Icon className="mb-3 h-6 w-6 text-accent" aria-hidden />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-xs text-muted-foreground">Data marked "Simulated" is demonstration data, not real citizen reports.</p>
        </section>
      </main>
    </>
  );
}