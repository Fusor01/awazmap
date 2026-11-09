import Link from "next/link";
import { MapPinned } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold text-lg">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground">
        <MapPinned className="h-5 w-5" aria-hidden />
      </span>
      AwaazMap
    </Link>
  );
}
