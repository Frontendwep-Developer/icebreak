import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // this is the user's email
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_error=1`
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const email = decodeURIComponent(state);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      // Google sometimes doesn't return a refresh_token if the user
      // already granted access before. "prompt=consent" avoids this,
      // but we still check just in case.
      console.error("No refresh token:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_error=1`
      );
    }

    // Find or create the user, then store the refresh token
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("users")
        .update({ google_refresh_token: tokenData.refresh_token })
        .eq("email", email);
    } else {
      await supabaseAdmin.from("users").insert({
        email,
        plan: "free",
        credits_used: 0,
        google_refresh_token: tokenData.refresh_token,
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_connected=1`
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_error=1`
    );
  }
}
