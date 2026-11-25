import "server-only";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
export type DateFilters = { from?: string; to?: string; customer?: string };
export function dates(filters: DateFilters) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = `${today.getUTCFullYear()}-01-01`;
  const from = z.iso.date().safeParse(filters.from);
  const to = z.iso.date().safeParse(filters.to);
  const start = from.success ? from.data : defaultFrom;
  const end = to.success ? to.data : defaultTo;
  return start <= end && Date.parse(end) - Date.parse(start) <= 3660 * 86400000
    ? { from: start, to: end }
    : { from: defaultFrom, to: defaultTo };
}
export type SalesReport = {
  ordered_minor: string;
  invoiced_minor: string;
  fulfilled_minor: string;
  monthly: { month: string; ordered_minor: string; invoiced_minor: string }[];
  representatives: {
    name: string;
    rep_id: string | null;
    ordered_minor: string;
    invoiced_minor: string;
  }[];
};
export async function salesReport(filters: DateFilters) {
  await requireSession("reporting");
  const range = dates(filters);
  const client = await serverClient();
  const { data, error } = await client.rpc("sales_report", {
    p_from: range.from,
    p_to: range.to,
  });
  return { range, report: queryResult<SalesReport>(data, error) };
}
