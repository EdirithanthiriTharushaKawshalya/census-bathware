import "server-only";
import type { ActionState } from "@/types/domain";
export function mutationResult(
  error: { message: string } | null,
  message: string,
  reference?: string,
): ActionState {
  if (error) {
    const safe = [
      "Access denied",
      "Customer is not approved",
      "Variant is unavailable",
      "Representative is not assigned",
      "Amount exceeds unallocated balance",
      "Use partial for shortages",
      "Invalid fulfilled quantity",
      "Enquiry limit reached. Please try later",
      "Invalid payment transition",
    ];
    return {
      ok: false,
      message: safe.includes(error.message)
        ? error.message
        : "Unable to save. Check the fields and your access, then retry with the same submission. Contact the office if this continues.",
    };
  }
  return { ok: true, message, reference };
}
export function queryResult<T>(
  data: unknown,
  error: { message: string } | null,
): T {
  if (error)
    throw new Error(
      "Unable to load workspace records. Verify the Supabase migrations and connection, then try again.",
    );
  return data as T;
}
