import { NextResponse } from "next/server";

// This endpoint is no longer needed — GitHub tokens are now stored
// server-side in the callback route. Kept as a no-op for safety.
export async function POST() {
  return NextResponse.json({ error: "Deprecated" }, { status: 410 });
}
