import { CatalogueView } from "@/features/catalogue/components";
import type { CatalogueFilters } from "@/features/catalogue/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<CatalogueFilters>;
}) {
  return <CatalogueView filters={await searchParams} />;
}
