import { Share } from "@capacitor/share";
import { can } from "@/features/auth/permissions";
import { balance, money, parseMoney } from "@/features/billing/money";
import type { Delivery, Invoice, Order, Profile } from "@/types/domain";
import { z } from "zod";
import { check, database, rpc } from "./client";
import { Data } from "./data";
import { ActionForm, Empty, Field, today, value } from "./ui";

export function Orders({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => void;
}) {
  return (
    <section>
      <h1>Orders</h1>
      <Data
        load={async () => ({
          orders: check(
            await database()
              .from("orders")
              .select("*,customers(shop_name),order_lines(*)")
              .order("created_at", { ascending: false })
              .limit(100),
          ) as Order[],
          deliveries: check(
            await database().from("deliveries").select("*").limit(500),
          ) as Delivery[],
        })}
      >
        {({ orders, deliveries }) => (
          <>
            {!orders.length && <Empty>No orders yet.</Empty>}
            {orders.map((order) => {
              const delivery = deliveries.find((d) => d.order_id === order.id);
              const fulfilled = order.order_lines.reduce(
                (sum, line) =>
                  sum +
                  BigInt(line.unit_price_minor) *
                    BigInt(
                      delivery?.items.find((i) => i.order_line_id === line.id)
                        ?.fulfilled || 0,
                    ),
                0n,
              );
              return (
                <article className="card" key={order.id}>
                  <p className="eyebrow">{order.reference}</p>
                  <h2>{order.customers.shop_name}</h2>
                  <p>
                    {new Date(order.created_at).toLocaleString()} ·{" "}
                    {order.terms}
                  </p>
                  <p>
                    Ordered {money(order.total_minor)} · Fulfilled{" "}
                    {money(fulfilled)}
                  </p>
                  <p>
                    Delivery:{" "}
                    {delivery?.status.replaceAll("_", " ") || "Not assigned"}
                  </p>
                  <ul>
                    {order.order_lines.map((line) => (
                      <li key={line.id}>
                        {line.description} · {line.sku} · {line.quantity} ×{" "}
                        {money(line.unit_price_minor)}
                      </li>
                    ))}
                  </ul>
                  {order.notes && <p>{order.notes}</p>}
                  {can(profile.role, "billing") && (
                    <ActionForm
                      label="Issue invoice"
                      success="Invoice issued. Open Invoices to review."
                      onSuccess={refresh}
                      submit={async (_, key) => {
                        await rpc("issue_invoice", {
                          p_order_id: order.id,
                          p_key: key,
                        });
                      }}
                    >
                      <p className="muted">
                        Issue an invoice using the original order quantities and
                        prices. An order can have one invoice.
                      </p>
                    </ActionForm>
                  )}
                </article>
              );
            })}
            <p className="muted">Showing the latest 100 permitted orders.</p>
          </>
        )}
      </Data>
    </section>
  );
}
export function Invoices({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => void;
}) {
  return (
    <section>
      <h1>Invoices & payments</h1>
      {can(profile.role, "billing") && (
        <details className="card">
          <summary>Issue an invoice</summary>
          <Data
            load={async () =>
              check(
                await database()
                  .from("orders")
                  .select("*,customers(shop_name),order_lines(*)")
                  .order("created_at", { ascending: false })
                  .limit(100),
              ) as Order[]
            }
          >
            {(orders) => (
              <ActionForm
                label="Issue digital invoice"
                onSuccess={refresh}
                submit={async (form, key) => {
                  await rpc("issue_invoice", {
                    p_order_id: String(form.get("order_id")),
                    p_key: key,
                  });
                }}
              >
                <Field label="Order to invoice">
                  <select name="order_id" required>
                    <option value="">Choose an order</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.reference} · {order.customers.shop_name} ·{" "}
                        {money(order.total_minor)}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="muted">
                  The database issues one invoice per order with permanent line
                  snapshots.
                </p>
              </ActionForm>
            )}
          </Data>
        </details>
      )}
      <Data
        load={async () =>
          check(
            await database()
              .from("invoices")
              .select("*,customers(shop_name),invoice_lines(*),payments(*)")
              .order("issued_at", { ascending: false })
              .limit(100),
          ) as Invoice[]
        }
      >
        {(invoices) => (
          <>
            {!invoices.length && <Empty>No invoices issued yet.</Empty>}
            {invoices.map((invoice) => (
              <article className="card" key={invoice.id}>
                <p className="eyebrow">
                  {invoice.reference} · {invoice.state}
                </p>
                <h2>{invoice.customers.shop_name}</h2>
                <p>{new Date(invoice.issued_at).toLocaleDateString()}</p>
                <ul>
                  {invoice.invoice_lines.map((line) => (
                    <li key={line.id}>
                      {line.description} · {line.quantity} ×{" "}
                      {money(line.unit_price_minor)}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Total {money(invoice.total_minor)}</strong>
                </p>
                <p>
                  Outstanding{" "}
                  {invoice.state === "void"
                    ? money(0)
                    : money(balance(invoice.total_minor, invoice.payments))}
                </p>
                <ActionForm
                  label="Share invoice summary"
                  success="Share opened."
                  submit={async () => {
                    await Share.share({
                      title: invoice.reference,
                      text: `${invoice.reference}\n${invoice.customers.shop_name}\n${invoice.invoice_lines.map((l) => `${l.description}: ${l.quantity} × ${money(l.unit_price_minor)}`).join("\n")}\nTotal: ${money(invoice.total_minor)}\nState: ${invoice.state}`,
                    });
                  }}
                >
                  <p className="muted">
                    Share this summary only with the intended recipient.
                  </p>
                </ActionForm>
                <h3>Payments</h3>
                {!invoice.payments.length && (
                  <p className="muted">No payments recorded.</p>
                )}
                {invoice.payments.map((payment) => (
                  <div className="variant" key={payment.id}>
                    <p>
                      {money(payment.amount_minor)} · {payment.method} ·{" "}
                      {payment.state} · {payment.paid_on}
                    </p>
                    {payment.cheque_number && (
                      <p>
                        Cheque {payment.cheque_number} · {payment.bank} ·{" "}
                        {payment.cheque_date}
                      </p>
                    )}
                    {can(profile.role, "billing") &&
                      ["pending", "cleared"].includes(payment.state) && (
                        <details>
                          <summary>Correct payment / clear cheque</summary>
                          <ActionForm
                            label="Save payment correction"
                            onSuccess={refresh}
                            submit={async (form) => {
                              await rpc("correct_payment", {
                                p_id: payment.id,
                                p_state: value(form, "state"),
                                p_reason: z
                                  .string()
                                  .min(5)
                                  .max(2000)
                                  .parse(value(form, "reason", 2000)),
                              });
                            }}
                          >
                            <Field label="New state">
                              <select name="state">
                                {payment.method === "cheque" &&
                                  payment.state === "pending" && (
                                    <>
                                      <option value="cleared">Cleared</option>
                                      <option value="bounced">Bounced</option>
                                    </>
                                  )}
                                <option value="void">Void</option>
                              </select>
                            </Field>
                            <Field label="Reason (at least 5 characters)">
                              <textarea
                                name="reason"
                                required
                                minLength={5}
                                maxLength={2000}
                              />
                            </Field>
                          </ActionForm>
                        </details>
                      )}
                  </div>
                ))}
                {can(profile.role, "billing") && invoice.state === "issued" && (
                  <>
                    <details>
                      <summary>Record a payment</summary>
                      <ActionForm
                        label="Record payment"
                        success="Payment recorded. Cheques only reduce the balance after clearance."
                        onSuccess={refresh}
                        submit={async (form, key) => {
                          const method = z
                            .enum(["cash", "bank", "cheque"])
                            .parse(form.get("method"));
                          const cheque = value(form, "cheque_number", 80);
                          const bank = value(form, "bank", 150);
                          const date = value(form, "cheque_date");
                          if (
                            method === "cheque" &&
                            (!cheque || !bank || !date)
                          )
                            throw new Error(
                              "Enter cheque number, bank and cheque date.",
                            );
                          await rpc("record_payment", {
                            p_invoice_id: invoice.id,
                            p_amount_minor: parseMoney(value(form, "amount")),
                            p_method: method,
                            p_paid_on: z.iso
                              .date()
                              .parse(value(form, "paid_on")),
                            p_cheque_number: cheque || null,
                            p_bank: bank || null,
                            p_cheque_date: date || null,
                            p_note: value(form, "note", 2000),
                            p_key: key,
                          });
                        }}
                      >
                        <Field label="Amount (LKR)">
                          <input
                            name="amount"
                            inputMode="decimal"
                            required
                            pattern="[0-9]+(\.[0-9]{1,2})?"
                          />
                        </Field>
                        <Field label="Method">
                          <select name="method">
                            <option value="cash">Cash</option>
                            <option value="bank">Bank transfer</option>
                            <option value="cheque">Cheque</option>
                          </select>
                        </Field>
                        <Field label="Payment date">
                          <input
                            name="paid_on"
                            type="date"
                            required
                            defaultValue={today()}
                            max={today()}
                          />
                        </Field>
                        <Field label="Cheque number (cheques only)">
                          <input name="cheque_number" maxLength={80} />
                        </Field>
                        <Field label="Bank (cheques only)">
                          <input name="bank" maxLength={150} />
                        </Field>
                        <Field label="Cheque date (cheques only)">
                          <input name="cheque_date" type="date" />
                        </Field>
                        <Field label="Notes">
                          <textarea name="note" maxLength={2000} />
                        </Field>
                      </ActionForm>
                    </details>
                    <details>
                      <summary>Void invoice</summary>
                      <ActionForm
                        label="Void invoice"
                        onSuccess={refresh}
                        submit={async (form) => {
                          await rpc("void_invoice", {
                            p_id: invoice.id,
                            p_reason: z
                              .string()
                              .min(5)
                              .max(2000)
                              .parse(value(form, "reason", 2000)),
                          });
                        }}
                      >
                        <p>
                          Pending or cleared payments must be corrected first.
                          The invoice remains in audit history.
                        </p>
                        <Field label="Reason">
                          <textarea
                            name="reason"
                            required
                            minLength={5}
                            maxLength={2000}
                          />
                        </Field>
                      </ActionForm>
                    </details>
                  </>
                )}
              </article>
            ))}
            <p className="muted">Showing the latest 100 permitted invoices.</p>
          </>
        )}
      </Data>
    </section>
  );
}
