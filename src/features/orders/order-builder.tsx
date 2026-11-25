"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { submitOrder } from "./actions";
import { money } from "@/features/billing/money";
import type { Customer, OrderCatalogueProduct, Profile } from "@/types/domain";
export function OrderBuilder({
  products,
  customers,
  reps,
  initialVariant,
  keyValue,
}: {
  products: OrderCatalogueProduct[];
  customers: Customer[];
  reps: Profile[];
  initialVariant?: string;
  keyValue: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    initialVariant ? { [initialVariant]: 1 } : {},
  );
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(false);
  const variants = products
    .filter((p) => p.active)
    .flatMap((p) =>
      p.variants.filter((v) => v.active).map((v) => ({ ...v, name: p.name })),
    );
  const lines = variants
    .filter((v) => quantities[v.id] > 0)
    .map((v) => ({ variant_id: v.id, quantity: quantities[v.id] }));
  const total = variants.reduce(
    (sum, v) => sum + (quantities[v.id] || 0) * v.price_minor,
    0,
  );
  return (
    <ActionForm
      lockOnSuccess
      action={submitOrder}
      submit={review ? "Confirm and submit order" : "Submit reviewed order"}
      confirm="Submit this order to Census? Prices and eligibility will be confirmed on the server."
    >
      <input type="hidden" name="key" value={keyValue} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="form-grid">
        <label>
          Customer / shop
          <select
            name="customer_id"
            required
            defaultValue={customers.length === 1 ? customers[0].id : ""}
          >
            <option value="" disabled>
              Choose an approved customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shop_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment terms
          <select name="terms">
            <option value="cash">Cash</option>
            <option value="credit">Credit (subject to office review)</option>
          </select>
        </label>
        {reps.length > 0 && (
          <label>
            Representative
            <select name="rep_id">
              <option value="">Use customer’s assigned representative</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        Find a variant
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products or SKUs"
        />
      </label>
      <div>
        {variants
          .filter((v) =>
            `${v.name} ${v.sku} ${v.label}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((v) => (
            <div className="order-pick" key={v.id}>
              <div>
                <strong>
                  {v.name} / {v.label}
                </strong>
                <p>
                  {v.sku} · {money(v.price_minor)} each
                </p>
              </div>
              <label>
                Quantity
                <input
                  type="number"
                  aria-label={`Quantity for ${v.sku}`}
                  min="0"
                  max="100000"
                  step="1"
                  value={quantities[v.id] || 0}
                  onChange={(e) => {
                    setQuantities({
                      ...quantities,
                      [v.id]: Math.max(
                        0,
                        Math.min(100000, Math.trunc(Number(e.target.value))),
                      ),
                    });
                    setReview(false);
                  }}
                />
              </label>
            </div>
          ))}
      </div>
      <label>
        Order notes
        <textarea
          name="notes"
          maxLength={4000}
          placeholder="Delivery instructions or details for the office"
        />
      </label>
      <div className="review">
        <h3>Review your order</h3>
        {lines.length ? (
          variants
            .filter((v) => quantities[v.id] > 0)
            .map((v) => (
              <p key={v.id}>
                {v.sku} · {quantities[v.id]} × {money(v.price_minor)} ={" "}
                {money(quantities[v.id] * v.price_minor)}
              </p>
            ))
        ) : (
          <p>Select at least one variant above.</p>
        )}
        <strong>Estimated total: {money(total)}</strong>
        <p>
          Final prices are resolved on the server. Submitting does not issue an
          invoice or record a payment.
        </p>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          required
          checked={review}
          onChange={(e) => setReview(e.target.checked)}
        />
        I have reviewed the quantities, customer, and terms.
      </label>
    </ActionForm>
  );
}
