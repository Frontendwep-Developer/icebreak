import { createClient } from "@supabase/supabase-js";

// Bu klient faqat SERVER tomonida (API route'larda) ishlatiladi.
// SUPABASE_SERVICE_ROLE_KEY hech qachon frontendga chiqmasligi kerak.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
