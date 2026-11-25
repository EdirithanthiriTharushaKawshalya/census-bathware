import { CollectionsView } from "@/features/collections/components";
import type { DateFilters } from "@/features/reporting/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DateFilters>;
}) {
  return <CollectionsView filters={await searchParams} />;
}
