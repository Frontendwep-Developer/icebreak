import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVerifiedEmail } from "@/lib/auth";

function buildFilteredQuery(email: string, req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get("q")?.trim() || "";
  const query = rawQuery.replace(/[,()%]/g, "");
  const from = req.nextUrl.searchParams.get("from"); // ISO date, e.g. 2026-08-01
  const to = req.nextUrl.searchParams.get("to");

  let qb = supabaseAdmin
    .from("generation_history")
    .select("*", { count: "exact" })
    .eq("user_email", email);

  if (query) {
    qb = qb.or(`lead_name.ilike.%${query}%,lead_company.ilike.%${query}%`);
  }
  if (from) {
    qb = qb.gte("created_at", from);
  }
  if (to) {
    // Include the entire "to" day by pushing to the next day's start.
    const toEnd = new Date(to);
    toEnd.setDate(toEnd.getDate() + 1);
    qb = qb.lt("created_at", toEnd.toISOString());
  }

  return qb;
}

// GET /api/history — past generated emails (Pro only)
// Add &export=1 to fetch ALL matching rows (up to 5000) instead of a page,
// for CSV export.
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

  const isExport = req.nextUrl.searchParams.get("export") === "1";

  if (isExport) {
    const EXPORT_CAP = 5000;
    const { data, error } = await buildFilteredQuery(email, req)
      .order("created_at", { ascending: false })
      .range(0, EXPORT_CAP - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ isPro: true, items: data || [] });
  }

  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  const PAGE_SIZE = 25;

  const { data, error, count } = await buildFilteredQuery(email, req)
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

// DELETE /api/history
// - ?id=X            — delete a single item
// - ?ids=1,2,3        — delete specific selected items
// - ?all=1&q=&from=&to= — delete everything matching the current filters
export async function DELETE(req: NextRequest) {
  const email = await getVerifiedEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const all = req.nextUrl.searchParams.get("all") === "1";
  const idsParam = req.nextUrl.searchParams.get("ids");
  const singleId = req.nextUrl.searchParams.get("id");

  if (all) {
    // Delete every row matching the current search/date filters for this user.
    const rawQuery = req.nextUrl.searchParams.get("q")?.trim() || "";
    const query = rawQuery.replace(/[,()%]/g, "");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    let qb = supabaseAdmin
      .from("generation_history")
      .delete()
      .eq("user_email", email);

    if (query) {
      qb = qb.or(`lead_name.ilike.%${query}%,lead_company.ilike.%${query}%`);
    }
    if (from) qb = qb.gte("created_at", from);
    if (to) {
      const toEnd = new Date(to);
      toEnd.setDate(toEnd.getDate() + 1);
      qb = qb.lt("created_at", toEnd.toISOString());
    }

    const { error } = await qb;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids is empty" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("generation_history")
      .delete()
      .in("id", ids)
      .eq("user_email", email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (!singleId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("generation_history")
    .delete()
    .eq("id", singleId)
    .eq("user_email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}