import Link from "next/link";
import { requireSession } from "@/features/auth/session";
import { catalogue } from "@/features/catalogue/queries";
import { customers, orders, staff } from "./queries";
import { deliveries } from "@/features/deliveries/queries";
import { OrderBuilder } from "./order-builder";
import { PageTitle, Empty, Status } from "@/components/ui/shared";
import { money } from "@/features/billing/money";
import { InvoiceList } from "@/features/billing/components";
export async function NewOrder({
  initialVariant,
}: {
  initialVariant?: string;
}) {
  const profile = await requireSession("orders");
  const [products, accounts, reps] = await Promise.all([
    catalogue(),
    customers(),
    ["office", "management", "admin"].includes(profile.role)
      ? staff("rep")
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageTitle
        eyebrow="A new order"
        title="Bring your next project together."
      >
        Choose a customer, select variants, and review before submitting.
      </PageTitle>
      {accounts.length && products.length ? (
        <div className="panel">
          <OrderBuilder
            products={products}
            customers={accounts}
            reps={reps}
            initialVariant={initialVariant}
            keyValue={crypto.randomUUID()}
          />
        </div>
      ) : (
        <Empty>
          An approved customer and active catalogue products are required to
          place an order. Contact the office.
        </Empty>
      )}
    </>
  );
}
export async function OrderHistory() {
  const actor = await requireSession("orders");
  const [records, dispatches] = await Promise.all([orders(), deliveries()]);
  return (
    <>
      <PageTitle
        eyebrow={
          actor.role === "rep"
            ? "Your assigned customers"
            : "Orders & confirmations"
        }
        title="Every order, in view."
      >
        Up to 500 recent orders permitted for your account. Ordered and
        fulfilled values are shown separately.
      </PageTitle>
      <Link href="/orders/new" className="button">
        Create an order
      </Link>
      <div className="record-list section" style={{ paddingBlock: 28 }}>
        {!records.length && (
          <Empty>No orders yet. Your submitted orders will appear here.</Empty>
        )}
        {records.map((o) => {
          const delivery = dispatches.find((d) => d.order_id === o.id);
          const fulfilled = o.order_lines.reduce(
            (sum, line) =>
              sum +
              (delivery?.items.find((i) => i.order_line_id === line.id)
                ?.fulfilled || 0) *
                line.unit_price_minor,
            0,
          );
          return (
            <article className="panel" key={o.id}>
              <div className="record-header">
                <div>
                  <h3>{o.reference}</h3>
                  <span className="record-meta">
                    {o.customers.shop_name} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("en-GB")} ·{" "}
                    {o.terms}
                  </span>
                </div>
                <Status>{delivery?.status || "Awaiting dispatch"}</Status>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product / variant</th>
                      <th>SKU</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Ordered value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.order_lines.map((l) => (
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
                Ordered total <strong>{money(o.total_minor)}</strong> · Actual
                fulfilled value <strong>{money(fulfilled)}</strong>
              </p>
              {o.notes && <p className="muted">{o.notes}</p>}
              <p className="fine-print">
                Submitted by{" "}
                {o.created_by === actor.id ? "you" : "your Census team"} ·{" "}
                {o.rep_id === actor.id
                  ? "Attributed to you"
                  : o.rep_id
                    ? "Representative assigned"
                    : "Representative unassigned"}
              </p>
            </article>
          );
        })}
      </div>
      {actor.role === "customer" && (
        <>
          <h2>Your invoices & payments</h2>
          <InvoiceList readOnly />
        </>
      )}
    </>
  );
}
