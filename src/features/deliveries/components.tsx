import { requireSession } from "@/features/auth/session";
import { staff, orders } from "@/features/orders/queries";
import { deliveries } from "./queries";
import { assignDelivery, updateDelivery } from "./actions";
import { ActionForm } from "@/components/ui/action-form";
import { PageTitle, Empty, Status } from "@/components/ui/shared";
export async function DeliveriesView() {
  const actor = await requireSession("deliveries");
  const isOffice = actor.role !== "delivery";
  const [queue, allOrders, drivers] = await Promise.all([
    deliveries(),
    isOffice ? orders() : Promise.resolve([]),
    isOffice ? staff("delivery") : Promise.resolve([]),
  ]);
  return (
    <>
      <PageTitle
        eyebrow="Dispatch & delivery"
        title="A clear view of the road ahead."
      >
        Record cumulative fulfilled quantities for each order. Shortages,
        delivery status, and collections stay separate from billing.
      </PageTitle>
      {isOffice && (
        <details className="panel details">
          <summary>Assign or reassign an order</summary>
          <ActionForm action={assignDelivery} submit="Save assignment">
            <label>
              Order
              <select name="order_id" required>
                <option value="">Select order</option>
                {allOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.reference} · {o.customers.shop_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Delivery staff
              <select name="assigned_to" required>
                <option value="">Select staff member</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </details>
      )}
      <div className="record-list" style={{ marginTop: 25 }}>
        {!queue.length && (
          <Empty>No assigned deliveries. New stops will appear here.</Empty>
        )}
        {queue.map((d) => (
          <article className="panel" key={d.id}>
            <div className="record-header">
              <div>
                <h3>{d.shop_name}</h3>
                <p className="muted">
                  {d.address ||
                    "Address pending; contact the office before dispatch."}
                </p>
              </div>
              <Status>{d.status.replaceAll("_", " ")}</Status>
            </div>
            <ActionForm action={updateDelivery} submit="Save delivery update">
              <input name="id" type="hidden" value={d.id} />
              <input name="key" type="hidden" value={crypto.randomUUID()} />
              {d.items.map((item) => (
                <div className="delivery-line" key={item.order_line_id}>
                  <div>
                    <strong>{item.description}</strong>
                    <p>
                      {item.sku} · Ordered {item.ordered}
                    </p>
                    <p className="shortage">
                      Shortage: {item.ordered - item.fulfilled}
                    </p>
                  </div>
                  <label>
                    Fulfilled
                    <input
                      name={`fulfilled:${item.order_line_id}`}
                      type="number"
                      defaultValue={item.fulfilled}
                      min="0"
                      max={item.ordered}
                      step="1"
                      required
                    />
                  </label>
                </div>
              ))}
              <label>
                Delivery status
                <select
                  name="status"
                  defaultValue={
                    d.status === "assigned" ? "out_for_delivery" : d.status
                  }
                >
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="partial">
                    Partially delivered / shortages
                  </option>
                  <option value="delivered">Delivered in full</option>
                  <option value="failed">Delivery failed</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  name="collection"
                  type="checkbox"
                  defaultChecked={d.collection_occurred}
                />
                A collection occurred at this stop
              </label>
              <label>
                Delivery notes
                <textarea
                  name="notes"
                  maxLength={2000}
                  placeholder="Shortage details, recipient, or follow-up needed"
                />
              </label>
              <p className="muted">
                This records a delivery event. Only authorized accounts or
                office staff may record a payment.
              </p>
            </ActionForm>
          </article>
        ))}
      </div>
    </>
  );
}
