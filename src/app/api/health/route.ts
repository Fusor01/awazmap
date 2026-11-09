import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
