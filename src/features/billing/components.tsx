import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/features/auth/session";
import { invoices } from "./queries";
import { orders } from "@/features/orders/queries";
import {
  issueInvoice,
  recordPayment,
  correctPayment,
  voidInvoice,
} from "./actions";
import { ActionForm } from "@/components/ui/action-form";
import { PageTitle, Empty, Status } from "@/components/ui/shared";
import { money, balance } from "./money";
import type { Invoice } from "@/types/domain";
export function InvoiceRecord({
  invoice: i,
  readOnly = false,
}: {
  invoice: Invoice;
  readOnly?: boolean;
}) {
  const outstanding =
    i.state === "void" ? 0 : balance(i.total_minor, i.payments);
  return (
    <article className="panel">
      <div className="print-only">
        <h2>Census Bathware</h2>
        <p>Digital invoice · LKR</p>
      </div>
      <div className="record-header">
        <div>
          <h3>{i.reference}</h3>
          <p className="record-meta">
            {i.customers.shop_name} · Issued{" "}
            {new Date(i.issued_at).toLocaleDateString("en-GB")}
          </p>
        </div>
        <Status>
          {i.state === "void"
            ? "Void"
            : outstanding === 0
              ? "Paid"
              : "Outstanding"}
        </Status>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {i.invoice_lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.sku}</td>
                <td>{l.quantity}</td>
                <td>{money(l.unit_price_minor)}</td>
                <td>{money(l.quantity * l.unit_price_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="record-meta" style={{ marginTop: 18 }}>
        Invoice total: <strong>{money(i.total_minor)}</strong> · Outstanding:{" "}
        <strong>{money(outstanding)}</strong>
      </p>
      {i.state === "void" && (
        <p className="notice">Void reason: {i.void_reason}</p>
      )}
      <Link className="text-link no-print" href={`/orders/invoices/${i.id}`}>
        Open digital invoice
      </Link>
      <h3 style={{ marginTop: 25 }}>Payment history</h3>
      {!i.payments.length ? (
        <p className="muted">No payments recorded.</p>
      ) : (
        <div className="stack">
          {i.payments.map((p) => (
            <div key={p.id}>
              <p className="muted">
                <strong>{money(p.amount_minor)}</strong> · {p.method} ·{" "}
                {p.paid_on} · <Status>{p.state}</Status>
              </p>
              {p.cheque_number && (
                <p className="fine-print">
                  Cheque {p.cheque_number} · {p.bank} · {p.cheque_date}
                </p>
              )}
              {p.note && <p className="fine-print">{p.note}</p>}
              {!readOnly && ["pending", "cleared"].includes(p.state) && (
                <details className="details no-print">
                  <summary>Clear or correct payment</summary>
                  <ActionForm
                    action={correctPayment}
                    submit="Record correction"
                    confirm="Apply this payment correction? The change will be audited."
                  >
                    <input name="id" type="hidden" value={p.id} />
                    <label>
                      Action
                      <select name="state">
                        {p.state === "pending" && (
                          <>
                            <option value="cleared">Cheque cleared</option>
                            <option value="bounced">Cheque bounced</option>
                          </>
                        )}
                        <option value="void">Void incorrect payment</option>
                      </select>
                    </label>
                    <label>
                      Reason
                      <input
                        name="reason"
                        required
                        minLength={5}
                        maxLength={2000}
                      />
                    </label>
                  </ActionForm>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && i.state !== "void" && (
        <details className="details no-print">
          <summary>Record a manual payment</summary>
          <ActionForm
            lockOnSuccess
            action={recordPayment}
            submit="Record payment"
            confirm="Record this payment against the invoice?"
          >
            <input name="invoice_id" type="hidden" value={i.id} />
            <input name="key" type="hidden" value={crypto.randomUUID()} />
            <div className="form-grid">
              <label>
                Amount (LKR)
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                />
              </label>
              <label>
                Method
                <select name="method">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
              <label>
                Payment date
                <input
                  name="paid_on"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label>
                Cheque number
                <input name="cheque_number" maxLength={80} />
              </label>
              <label>
                Bank
                <input name="bank" maxLength={150} />
              </label>
              <label>
                Cheque date
                <input name="cheque_date" type="date" />
              </label>
            </div>
            <label>
              Payment note
              <textarea name="note" maxLength={2000} />
            </label>
            <p className="muted">
              Pending cheques reserve the invoice amount against duplicate
              collection, but remain outstanding until cleared.
            </p>
          </ActionForm>
        </details>
      )}
      {!readOnly && i.state !== "void" && (
        <details className="details no-print">
          <summary>Void an incorrect invoice</summary>
          <ActionForm
            action={voidInvoice}
            submit="Void invoice"
            confirm="Void this invoice? All payments must first be voided or bounced. This action is audited."
          >
            <input name="id" type="hidden" value={i.id} />
            <label>
              Correction reason
              <input name="reason" required minLength={5} maxLength={2000} />
            </label>
            <p className="muted">
              Original lines remain preserved. Create a corrected order for
              replacement billing.
            </p>
          </ActionForm>
        </details>
      )}
    </article>
  );
}
export async function InvoiceList({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  await requireSession();
  const records = await invoices();
  return (
    <div className="record-list" style={{ marginTop: 25 }}>
      {!records.length && <Empty>No invoices have been issued.</Empty>}
      {records.map((i) => (
        <InvoiceRecord key={i.id} invoice={i} readOnly={readOnly} />
      ))}
    </div>
  );
}
export async function BillingView() {
  await requireSession("billing");
  const [allOrders, allInvoices] = await Promise.all([orders(), invoices()]);
  const available = allOrders.filter(
    (o) => !allInvoices.some((i) => i.order_id === o.id),
  );
  return (
    <>
      <PageTitle eyebrow="Office & accounts" title="Billing, with clarity.">
        Review an order and explicitly issue its invoice. Invoicing and payment
        states are independent of delivery.
      </PageTitle>
      <details className="panel details">
        <summary>
          Review orders awaiting an invoice ({available.length})
        </summary>
        {!available.length ? (
          <Empty>No recent orders awaiting invoicing.</Empty>
        ) : (
          available.map((o) => (
            <div className="record-actions" key={o.id}>
              <div>
                <h3>
                  {o.reference} · {o.customers.shop_name}
                </h3>
                <p className="muted">
                  {o.terms} · {money(o.total_minor)}
                </p>
                {o.order_lines.map((l) => (
                  <p className="fine-print" key={l.id}>
                    {l.sku} · {l.quantity} × {money(l.unit_price_minor)}
                  </p>
                ))}
              </div>
              <ActionForm
                lockOnSuccess
                action={issueInvoice}
                submit="Issue digital invoice"
                confirm="Issue an invoice using the order’s snapshotted quantities and prices?"
              >
                <input name="order_id" type="hidden" value={o.id} />
                <input name="key" type="hidden" value={crypto.randomUUID()} />
              </ActionForm>
            </div>
          ))
        )}
      </details>
      <InvoiceList />
    </>
  );
}
export async function DigitalInvoice({ id }: { id: string }) {
  const actor = await requireSession();
  const i = (await invoices()).find((i) => i.id === id);
  if (!i) notFound();
  return (
    <>
      <PageTitle eyebrow="Digital invoice" title={i.reference}>
        Use your browser’s Print command to save or print this invoice.
      </PageTitle>
      <InvoiceRecord
        invoice={i}
        readOnly={
          !["office", "accounts", "management", "admin"].includes(actor.role)
        }
      />
    </>
  );
}
