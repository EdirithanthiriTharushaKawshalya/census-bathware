import { z } from "zod";
export const orderInput = z.object({
  customer_id: z.uuid(),
  rep_id: z.union([z.uuid(), z.literal("")]).optional(),
  terms: z.enum(["cash", "credit"]),
  notes: z.string().max(4000),
  key: z.uuid(),
  lines: z
    .array(
      z.object({
        variant_id: z.uuid(),
        quantity: z.number().int().min(1).max(100000),
      }),
    )
    .min(1)
    .max(100),
});
export function uniqueVariants(lines: { variant_id: string }[]) {
  return new Set(lines.map((line) => line.variant_id)).size === lines.length;
}
