import { ReportsView } from "@/features/reporting/components";
import type { DateFilters } from "@/features/reporting/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DateFilters>;
}) {
  return <ReportsView filters={await searchParams} />;
}
