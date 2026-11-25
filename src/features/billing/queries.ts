import "server-only";
import { cache } from "react";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import type { Invoice } from "@/types/domain";
export const invoices = cache(async () => {
  await requireSession();
  const client = await serverClient();
  const { data, error } = await client
    .from("invoices")
    .select("*,customers(shop_name),invoice_lines(*),payments(*)")
    .order("issued_at", { ascending: false })
    .limit(500);
  return queryResult<Invoice[]>(data, error);
});
