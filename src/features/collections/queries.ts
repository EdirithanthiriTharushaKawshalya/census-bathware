import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import { dates, type DateFilters } from "@/features/reporting/queries";
export type CollectionsReport = {
  outstanding_minor: string;
  collection_minor: string;
  balances: {
    id: string;
    shop_name: string;
    invoiced_minor: string;
    paid_minor: string;
  }[];
  pending: {
    id: string;
    invoice_id: string;
    amount_minor: number;
    cheque_number: string;
    bank: string;
    cheque_date: string;
    shop_name: string;
    reference: string;
  }[];
};
export async function collectionsReport(filters: DateFilters) {
  await requireSession("collections");
  const range = dates(filters);
  const client = await serverClient();
  const { data, error } = await client.rpc("collections_report", {
    p_from: range.from,
    p_to: range.to,
  });
  return queryResult<CollectionsReport>(data, error);
}
