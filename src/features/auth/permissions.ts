import type { Role } from "@/types/domain";
export type Capability =
  | "catalogue"
  | "orders"
  | "enquiries"
  | "billing"
  | "deliveries"
  | "collections"
  | "reporting"
  | "manageCatalogue";
const grants: Record<Capability, readonly Role[]> = {
  catalogue: ["customer", "rep", "office", "accounts", "management", "admin"],
  orders: ["customer", "rep", "office", "management", "admin"],
  enquiries: ["customer", "rep", "office", "management", "admin"],
  billing: ["office", "accounts", "management", "admin"],
  deliveries: ["delivery", "office", "management", "admin"],
  collections: ["accounts", "office", "management", "admin"],
  reporting: ["rep", "office", "accounts", "management", "admin"],
  manageCatalogue: ["office", "management", "admin"],
};
export function can(role: Role, capability: Capability) {
  return grants[capability].includes(role);
}
export function assignedDelivery(
  actor: { id: string; role: Role },
  assignedTo: string,
) {
  return actor.role === "delivery"
    ? actor.id === assignedTo
    : ["office", "management", "admin"].includes(actor.role);
}
