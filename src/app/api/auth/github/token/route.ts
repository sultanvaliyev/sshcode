import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Returns the GitHub token from the httpOnly cookie so the client
// can pass it to the Convex mutation for encrypted storage.
// The cookie is deleted immediately after reading.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = req.cookies.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 400 });
  }

  const response = NextResponse.json({ token });
  response.cookies.delete("github_token");
  response.cookies.delete("github_username");
  return response;
}
