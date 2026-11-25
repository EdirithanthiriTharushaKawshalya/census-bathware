import { DigitalInvoice } from "@/features/billing/components";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DigitalInvoice id={(await params).id} />;
}
