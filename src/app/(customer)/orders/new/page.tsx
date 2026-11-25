import { NewOrder } from "@/features/orders/components";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  return <NewOrder initialVariant={(await searchParams).variant} />;
}
