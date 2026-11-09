"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <CardContent role="alert" className="flex flex-col items-start gap-3 p-6">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">This page couldn't load. The database or a service may be temporarily unavailable.</p>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}