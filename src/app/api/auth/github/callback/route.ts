import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/dashboard/settings`;

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const storedState = req.cookies.get("github_oauth_state")?.value;

  // User denied access
  if (error) {
    return NextResponse.redirect(`${settingsUrl}?github_error=denied`);
  }

  // CSRF check
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${settingsUrl}?github_error=invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${appUrl}/api/auth/github/callback`,
        }),
      }
    );

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("GitHub token exchange error:", tokenData);
      return NextResponse.redirect(`${settingsUrl}?github_error=exchange_failed`);
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub username
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = await userRes.json();

    // Pass token + username to settings page via short-lived cookie
    // The settings page will call the Convex mutation to encrypt & store
    const response = NextResponse.redirect(`${settingsUrl}?github=connected`);

    response.cookies.set("github_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60, // 1 minute — just long enough for the page to read it
      path: "/",
    });
    response.cookies.set("github_username", githubUser.login, {
      httpOnly: false, // client needs to read this
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60,
      path: "/",
    });
    response.cookies.delete("github_oauth_state");

    return response;
  } catch (e: any) {
    console.error("GitHub OAuth callback error:", e);
    return NextResponse.redirect(`${settingsUrl}?github_error=exchange_failed`);
  }
}
