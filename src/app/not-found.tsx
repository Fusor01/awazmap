import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">That page doesn't exist, or the report link is no longer valid.</p>
      <Link href="/" className={cn(buttonVariants({ variant: "accent" }))}>Back to AwaazMap</Link>
    </main>
  );
}