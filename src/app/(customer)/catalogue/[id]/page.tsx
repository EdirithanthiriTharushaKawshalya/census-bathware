import { ProductView } from "@/features/catalogue/components";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProductView id={(await params).id} />;
}
