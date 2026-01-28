import { NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const connection = await getDBConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) as c FROM user");
    const count = Number((rows?.[0] as any)?.c ?? 0);
    return NextResponse.json({ hasAnyUser: count > 0, count }, { status: 200 });
  } catch (e) {
    console.error("bootstrap-status error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    await connection.end();
  }
}
