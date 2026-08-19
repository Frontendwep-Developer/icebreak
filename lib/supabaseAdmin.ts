import { createClient } from "@supabase/supabase-js";

// This client is only used SERVER-SIDE (in API routes).
// SUPABASE_SERVICE_ROLE_KEY must never be exposed to the frontend.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);
