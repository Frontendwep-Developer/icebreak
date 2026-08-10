import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state"); // bu — foydalanuvchi emaili
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_error=1`
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "code yoki state yo'q" }, { status: 400 });
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
      // Google ba'zan refresh_token qaytarmaydi, agar foydalanuvchi
      // avval ham ruxsat bergan bo'lsa. "prompt=consent" shu muammoni oldini oladi,
      // lekin baribir tekshiramiz.
      console.error("Refresh token yo'q:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tool?gmail_error=1`
      );
    }

    // Foydalanuvchini topamiz yoki yaratamiz, refresh tokenni saqlaymiz
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