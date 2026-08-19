import { createClient } from "@supabase/supabase-js";

// This client is used in the BROWSER (client components).
// It uses the publishable key, which is safe to expose.
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);