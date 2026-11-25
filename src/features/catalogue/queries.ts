import "server-only";
import { cache } from "react";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import type { Product, OrderCatalogueProduct } from "@/types/domain";
export type CatalogueFilters = {
  q?: string;
  category?: string;
  brand?: string;
  page?: string;
};
export type CataloguePage = {
  products: Product[];
  total: number;
  page: number;
  page_size: number;
  categories: string[];
  brands: string[];
};
export async function cataloguePage(filters: CatalogueFilters) {
  await requireSession("catalogue");
  const client = await serverClient();
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .safeParse(filters.page || "1");
  const { data, error } = await client.rpc("catalogue_page", {
    p_query: (filters.q || "").slice(0, 200),
    p_category: (filters.category || "").slice(0, 100),
    p_brand: (filters.brand || "").slice(0, 100),
    p_page: page.success ? page.data : 1,
  });
  return queryResult<CataloguePage>(data, error);
}
export const catalogue = cache(async () => {
  await requireSession("catalogue");
  const client = await serverClient();
  const { data, error } = await client
    .from("products")
    .select("id,name,active,variants(id,sku,label,price_minor,active)")
    .eq("active", true)
    .order("name")
    .limit(500);
  return queryResult<OrderCatalogueProduct[]>(data, error);
});
export const productById = cache(async (id: string) => {
  await requireSession("catalogue");
  if (!z.uuid().safeParse(id).success) return null;
  const client = await serverClient();
  const { data, error } = await client
    .from("products")
    .select("*,variants(*),product_images(*)")
    .eq("id", id)
    .order("created_at", {
      referencedTable: "product_images",
      ascending: false,
    })
    .maybeSingle();
  return queryResult<Product | null>(data, error);
});
