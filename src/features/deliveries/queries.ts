import "server-only";
import { cache } from "react";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import type { Delivery } from "@/types/domain";
export const deliveries = cache(async () => {
  await requireSession();
  const client = await serverClient();
  const { data, error } = await client
    .from("deliveries")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  return queryResult<Delivery[]>(data, error);
});
