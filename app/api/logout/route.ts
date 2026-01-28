import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  
  // Suppression du cookie
  cookieStore.delete("userId");

  return NextResponse.json({ success: true });
}