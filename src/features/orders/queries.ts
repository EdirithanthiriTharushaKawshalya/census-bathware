import "server-only";
import { cache } from "react";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import type { Customer, Order, Profile } from "@/types/domain";
export const orders = cache(async () => {
  await requireSession();
  const client = await serverClient();
  const { data, error } = await client
    .from("orders")
    .select("*,customers(shop_name),order_lines(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  return queryResult<Order[]>(data, error);
});
export const customers = cache(async () => {
  await requireSession();
  const client = await serverClient();
  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("approved", true)
    .order("shop_name")
    .limit(500);
  return queryResult<Customer[]>(data, error);
});
export const staff = cache(async (role: string) => {
  await requireSession();
  const client = await serverClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", role)
    .eq("active", true);
  return queryResult<Profile[]>(data, error);
});
