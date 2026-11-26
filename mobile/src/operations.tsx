import { z } from "zod";
import type { Delivery, Enquiry, Order, Profile } from "@/types/domain";
import { money } from "@/features/billing/money";
import type { SalesReport } from "@/features/reporting/queries";
import type { CollectionsReport } from "@/features/collections/queries";
import { check, database, rpc } from "./client";
import { Data } from "./data";
import { ActionForm, Empty, Field, id, today, value } from "./ui";
import { useState } from "react";

export function Deliveries({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => void;
}) {
  return (
    <section>
      <h1>Delivery queue</h1>
      <p>
        Record cumulative fulfilled quantities. Collection confirmation is
        separate from a payment record.
      </p>
      {profile.role !== "delivery" && (
        <Data
          load={async () => ({
            orders: check(
              await database()
                .from("orders")
                .select("*,customers(shop_name),order_lines(*)")
                .order("created_at", { ascending: false })
                .limit(500),
            ) as Order[],
            drivers: check(
              await database()
                .from("profiles")
                .select("id,full_name")
                .eq("active", true)
                .eq("role", "delivery"),
            ) as Profile[],
          })}
        >
          {({ orders, drivers }) => (
            <details className="card">
              <summary>Assign a delivery</summary>
              <ActionForm
                label="Assign delivery"
                onSuccess={refresh}
                submit={async (form) => {
                  await rpc("assign_delivery", {
                    p_order_id: id(form, "order"),
                    p_assigned_to: id(form, "driver"),
                  });
                }}
              >
                <Field label="Order">
                  <select name="order" required>
                    <option value="">Choose an order</option>
                    {orders.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.reference} · {o.customers.shop_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Driver">
                  <select name="driver" required>
                    <option value="">Choose delivery staff</option>
                    {drivers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </ActionForm>
            </details>
          )}
        </Data>
      )}
      <Data
        load={async () =>
          check(
            await database()
              .from("deliveries")
              .select("*")
              .order("updated_at", { ascending: false })
              .limit(100),
          ) as Delivery[]
        }
      >
        {(deliveries) => (
          <>
            {!deliveries.length && <Empty>No assigned deliveries.</Empty>}
            {deliveries.map((delivery) => (
              <article className="card" key={delivery.id}>
                <p className="eyebrow">
                  {delivery.status.replaceAll("_", " ")}
                </p>
                <h2>{delivery.shop_name}</h2>
                <p>{delivery.address}</p>
                <p className="muted">Delivery ID: {delivery.id}</p>
                <ActionForm
                  label="Save delivery update"
                  success="Delivery updated. Accounts must record any payment separately."
                  onSuccess={refresh}
                  submit={async (form, key) => {
                    const items = delivery.items.map((item) => ({
                      order_line_id: item.order_line_id,
                      fulfilled: z.coerce
                        .number()
                        .int()
                        .min(0)
                        .max(item.ordered)
                        .parse(form.get(item.order_line_id)),
                    }));
                    await rpc("update_delivery", {
                      p_id: delivery.id,
                      p_status: z
                        .enum([
                          "out_for_delivery",
                          "partial",
                          "delivered",
                          "failed",
                        ])
                        .parse(form.get("status")),
                      p_items: items,
                      p_collection: form.get("collection") === "on",
                      p_notes: value(form, "notes", 2000),
                      p_key: key,
                    });
                  }}
                >
                  {delivery.items.map((item) => (
                    <Field
                      key={item.order_line_id}
                      label={`${item.description} · ${item.sku} · ordered ${item.ordered} · shortage ${item.ordered - item.fulfilled}`}
                    >
                      <input
                        name={item.order_line_id}
                        type="number"
                        required
                        min={0}
                        max={item.ordered}
                        step={1}
                        defaultValue={item.fulfilled}
                      />
                    </Field>
                  ))}
                  <Field label="Delivery status">
                    <select
                      name="status"
                      defaultValue={
                        delivery.status === "assigned"
                          ? "out_for_delivery"
                          : delivery.status
                      }
                    >
                      <option value="out_for_delivery">Out for delivery</option>
                      <option value="partial">Partially delivered</option>
                      <option value="delivered">Delivered in full</option>
                      <option value="failed">Failed</option>
                    </select>
                  </Field>
                  <label className="check">
                    <input
                      type="checkbox"
                      name="collection"
                      defaultChecked={delivery.collection_occurred}
                    />
                    Collection occurred
                  </label>
                  <Field label="Notes / shortage details">
                    <textarea name="notes" maxLength={2000} />
                  </Field>
                </ActionForm>
              </article>
            ))}
            <p className="muted">
              Showing the latest 100 permitted deliveries.
            </p>
          </>
        )}
      </Data>
    </section>
  );
}
export function Enquiries({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => void;
}) {
  return (
    <section>
      <h1>Enquiries</h1>
      <details className="card">
        <summary>Send an enquiry</summary>
        <ActionForm
          label="Send enquiry"
          success="Enquiry received."
          onSuccess={undefined}
          submit={async (form, key) =>
            rpc<string>("submit_enquiry", {
              p_contact_name: value(form, "name", 150),
              p_email: z.email().parse(value(form, "email", 254)),
              p_phone: value(form, "phone", 40),
              p_request: value(form, "request", 4000),
              p_quantity: form.get("quantity")
                ? z.coerce
                    .number()
                    .int()
                    .min(1)
                    .max(999999)
                    .parse(form.get("quantity"))
                : null,
              p_notes: value(form, "notes", 4000),
              p_key: key,
            })
          }
        >
          <Field label="Contact name">
            <input
              name="name"
              required
              defaultValue={profile.full_name}
              maxLength={150}
            />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required maxLength={254} />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" required maxLength={40} />
          </Field>
          <Field label="Products or general enquiry">
            <textarea name="request" required maxLength={4000} />
          </Field>
          <Field label="Quantity (if relevant)">
            <input
              name="quantity"
              type="number"
              min={1}
              max={999999}
              step={1}
            />
          </Field>
          <Field label="Notes">
            <textarea name="notes" maxLength={4000} />
          </Field>
        </ActionForm>
      </details>
      <Data
        load={async () =>
          check(
            await database()
              .from("enquiries")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100),
          ) as Enquiry[]
        }
      >
        {(enquiries) => (
          <>
            {!enquiries.length && (
              <Empty>
                No enquiries yet. Newly submitted enquiries appear after
                reopening this screen.
              </Empty>
            )}
            {enquiries.map((enquiry) => (
              <article className="card" key={enquiry.id}>
                <p className="eyebrow">
                  {enquiry.reference} · {enquiry.status}
                </p>
                <h2>{enquiry.contact_name}</h2>
                <p>{enquiry.request}</p>
                {enquiry.quantity && <p>Quantity: {enquiry.quantity}</p>}
                <p>{enquiry.notes}</p>
                <p>
                  {enquiry.email} · {enquiry.phone}
                </p>
                {profile.role !== "customer" && (
                  <ActionForm
                    label="Update follow-up"
                    onSuccess={refresh}
                    submit={async (form) => {
                      await rpc("update_enquiry", {
                        p_id: enquiry.id,
                        p_status: z
                          .enum(["new", "following_up", "closed"])
                          .parse(form.get("status")),
                      });
                    }}
                  >
                    <Field label="Follow-up status">
                      <select name="status" defaultValue={enquiry.status}>
                        <option value="new">New</option>
                        <option value="following_up">Following up</option>
                        <option value="closed">Closed</option>
                      </select>
                    </Field>
                  </ActionForm>
                )}
              </article>
            ))}
          </>
        )}
      </Data>
    </section>
  );
}
export function Reports({ collections }: { collections: boolean }) {
  const [range, setRange] = useState({
    from: `${new Date().getUTCFullYear()}-01-01`,
    to: today(),
  });
  return (
    <section>
      <h1>{collections ? "Collections" : "Sales reports"}</h1>
      <form
        className="card filters"
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          const from = value(f, "from");
          const to = value(f, "to");
          if (from > to) {
            event.currentTarget
              .querySelector("input")
              ?.setCustomValidity("Start date must be before end date.");
            event.currentTarget.reportValidity();
            return;
          }
          setRange({ from, to });
        }}
      >
        <Field label="From">
          <input
            name="from"
            type="date"
            defaultValue={range.from}
            required
            onChange={(e) => e.target.setCustomValidity("")}
          />
        </Field>
        <Field label="To">
          <input name="to" type="date" defaultValue={range.to} required />
        </Field>
        <button>Apply dates</button>
      </form>
      {collections ? (
        <Data
          key={JSON.stringify(range)}
          load={() =>
            rpc<CollectionsReport>("collections_report", {
              p_from: range.from,
              p_to: range.to,
            })
          }
        >
          {(report) => (
            <>
              <div className="card">
                <h2>Outstanding {money(report.outstanding_minor)}</h2>
                <p>
                  Collections in date range {money(report.collection_minor)}
                </p>
              </div>
              <h2>Customer balances</h2>
              {!report.balances.length && <Empty>No balances.</Empty>}
              {report.balances.map((row) => (
                <article className="card" key={row.id}>
                  <h3>{row.shop_name}</h3>
                  <p>
                    Invoiced {money(row.invoiced_minor)} · Paid{" "}
                    {money(row.paid_minor)}
                  </p>
                  <strong>
                    Outstanding{" "}
                    {money(BigInt(row.invoiced_minor) - BigInt(row.paid_minor))}
                  </strong>
                </article>
              ))}
              <h2>Pending cheques</h2>
              {!report.pending.length && <Empty>No pending cheques.</Empty>}
              {report.pending.map((row) => (
                <article className="card" key={row.id}>
                  <h3>
                    {row.shop_name} · {row.reference}
                  </h3>
                  <p>
                    {money(row.amount_minor)} · Cheque {row.cheque_number}
                  </p>
                  <p>
                    {row.bank} · {row.cheque_date}
                  </p>
                </article>
              ))}
            </>
          )}
        </Data>
      ) : (
        <Data
          key={JSON.stringify(range)}
          load={() =>
            rpc<SalesReport>("sales_report", {
              p_from: range.from,
              p_to: range.to,
            })
          }
        >
          {(report) => (
            <>
              <div className="card">
                <p>Ordered {money(report.ordered_minor)}</p>
                <p>Invoiced {money(report.invoiced_minor)}</p>
                <p>Fulfilled {money(report.fulfilled_minor)}</p>
              </div>
              <h2>Monthly sales</h2>
              {report.monthly.map((row) => (
                <article className="card" key={row.month}>
                  <h3>{row.month}</h3>
                  <p>
                    Ordered {money(row.ordered_minor)} · Invoiced{" "}
                    {money(row.invoiced_minor)}
                  </p>
                </article>
              ))}
              <h2>By representative</h2>
              {report.representatives.map((row) => (
                <article className="card" key={row.rep_id || "unassigned"}>
                  <h3>{row.name}</h3>
                  <p>
                    Ordered {money(row.ordered_minor)} · Invoiced{" "}
                    {money(row.invoiced_minor)}
                  </p>
                </article>
              ))}
              <p className="muted">
                Profit is unavailable until cost data and its calculation are
                approved and configured.
              </p>
            </>
          )}
        </Data>
      )}
    </section>
  );
}
