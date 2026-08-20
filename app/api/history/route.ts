import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVerifiedEmail } from "@/lib/auth";

// GET /api/history — past generated emails (Pro only)
export async function GET(req: NextRequest) {
  const email = await getVerifiedEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("plan")
    .eq("email", email)
    .single();

  if (!user || user.plan !== "pro") {
    return NextResponse.json(
      { error: "History is a Pro feature", isPro: false },
      { status: 403 }
    );
  }

  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  const PAGE_SIZE = 25;

  const { data, error, count } = await supabaseAdmin
    .from("generation_history")
    .select("*", { count: "exact" })
    .eq("user_email", email)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    isPro: true,
    items: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + PAGE_SIZE,
  });
}

// DELETE /api/history — remove a single history item
export async function DELETE(req: NextRequest) {
  const email = await getVerifiedEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // .eq("user_email", email) ensures a user can only delete their own rows
  const { error } = await supabaseAdmin
    .from("generation_history")
    .delete()
    .eq("id", id)
    .eq("user_email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}