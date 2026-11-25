export const roles = [
  "customer",
  "rep",
  "office",
  "delivery",
  "accounts",
  "management",
  "admin",
] as const;
export type Role = (typeof roles)[number];
export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
};
export type Customer = {
  id: string;
  shop_name: string;
  user_id: string | null;
  approved: boolean;
  address: string;
  phone: string;
};
export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  label: string;
  price_minor: number;
  attributes: Record<string, string>;
  active: boolean;
};
export type ProductImage = {
  id: string;
  path: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  variants?: import("@/features/catalogue/image-policy").ImageVariant[];
};
export type OrderCatalogueProduct = Pick<Product, "id" | "name" | "active"> & {
  variants: Pick<Variant, "id" | "sku" | "label" | "price_minor" | "active">[];
};
export type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  warranty: string | null;
  active: boolean;
  variants: Variant[];
  product_images: ProductImage[];
};
export type OrderLine = {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  variant_id: string;
};
export type Order = {
  id: string;
  reference: string;
  customer_id: string;
  rep_id: string | null;
  created_by: string;
  created_at: string;
  terms: string;
  notes: string;
  total_minor: number;
  customers: { shop_name: string };
  order_lines: OrderLine[];
};
export type InvoiceLine = {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
};
export type Payment = {
  id: string;
  invoice_id: string;
  amount_minor: number;
  method: string;
  state: string;
  paid_on: string;
  cheque_number: string | null;
  bank: string | null;
  cheque_date: string | null;
  note: string;
};
export type Invoice = {
  id: string;
  reference: string;
  order_id: string;
  customer_id: string;
  issued_at: string;
  state: string;
  void_reason: string | null;
  total_minor: number;
  customers: { shop_name: string };
  invoice_lines: InvoiceLine[];
  payments: Payment[];
};
export type DeliveryItem = {
  order_line_id: string;
  sku: string;
  description: string;
  ordered: number;
  fulfilled: number;
};
export type Delivery = {
  id: string;
  order_id: string;
  customer_id: string;
  assigned_to: string;
  shop_name: string;
  address: string;
  status: string;
  collection_occurred: boolean;
  items: DeliveryItem[];
  updated_at: string;
};
export type Enquiry = {
  id: string;
  reference: string;
  contact_name: string;
  email: string;
  phone: string;
  request: string;
  quantity: number | null;
  notes: string;
  status: string;
  created_at: string;
};
export type ActionState = { ok: boolean; message: string; reference?: string };
