import type { Payment } from "@/types/domain";
export function money(minor: number | string | bigint) {
  const amount = BigInt(minor);
  const absolute = amount < BigInt(0) ? -amount : amount;
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  const formatted = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  })
    .formatToParts(absolute / BigInt(100))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
  return amount < BigInt(0) ? `-${formatted}` : formatted;
}
export function parseMoney(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function eligiblePayment(payment: Pick<Payment, "state" | "method">) {
  return (
    payment.state === "cleared" &&
    ["cash", "bank", "cheque"].includes(payment.method)
  );
}
export function balance(
  total: number,
  payments: Pick<Payment, "state" | "method" | "amount_minor">[],
) {
  return (
    total -
    payments
      .filter(eligiblePayment)
      .reduce((sum, payment) => sum + payment.amount_minor, 0)
  );
}
export function snapshotTotal(
  lines: { quantity: number; unit_price_minor: number }[],
) {
  return lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price_minor,
    0,
  );
}
