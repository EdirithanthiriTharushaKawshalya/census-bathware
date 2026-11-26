import { useState } from "react";
import { z } from "zod";
import type { Customer, Product, Profile, Variant } from "@/types/domain";
import { can } from "@/features/auth/permissions";
import { money, parseMoney } from "@/features/billing/money";
import { prepareImage } from "@/features/catalogue/image-preparation";
import { database, check, rpc } from "./client";
import { Data } from "./data";
import { ActionForm, Empty, Field, id, value } from "./ui";
import { Icon } from "./icons";

export type CartLine = { variant: Variant; name: string; quantity: number };
type Page = {
  products: Product[];
  total: number;
  page_size: number;
  categories: string[];
  brands: string[];
};
export function Catalogue({
  profile,
  add,
}: {
  profile: Profile;
  add: (line: CartLine) => void;
}) {
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    brand: "",
    page: 1,
  });
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [saved, setSaved] = useState(0);
  return (
    <section>
      <h1>Catalogue</h1>
      <p>Find the right fit for your next order.</p>
      {can(profile.role, "manageCatalogue") && (
        <button className="page-action" onClick={() => setEditing(null)}>
          Add a product
        </button>
      )}
      {editing !== undefined && (
        <section className="card">
          <button className="secondary" onClick={() => setEditing(undefined)}>
            Close editor
          </button>
          <ProductEditor
            product={editing}
            saved={() => setSaved((x) => x + 1)}
          />
        </section>
      )}
      <form
        className="card filters catalogue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setFilters({
            q: value(form, "q", 200),
            category: value(form, "category", 100),
            brand: value(form, "brand", 100),
            page: 1,
          });
        }}
      >
        <Field label="Search name or SKU">
          <input name="q" type="search" maxLength={200} />
        </Field>
        <Field label="Category">
          <input name="category" placeholder="All categories" maxLength={100} />
        </Field>
        <Field label="Brand">
          <input name="brand" placeholder="All brands" maxLength={100} />
        </Field>
        <button>Search</button>
      </form>
      <Data
        key={JSON.stringify(filters) + saved}
        load={async () => {
          const page = await rpc<Page>("catalogue_page", {
            p_query: filters.q,
            p_category: filters.category,
            p_brand: filters.brand,
            p_page: filters.page,
          });
          const signed: Record<string, string> = {};
          const paths = page.products
            .map(
              (p) =>
                p.product_images?.[0]?.variants?.[0]?.path ||
                p.product_images?.[0]?.path,
            )
            .filter((p): p is string => Boolean(p));
          if (paths.length)
            for (const image of check(
              await database()
                .storage.from("catalogue")
                .createSignedUrls(paths, 300),
            ) || [])
              if (image.signedUrl) signed[image.path!] = image.signedUrl;
          return { page, signed };
        }}
      >
        {({ page, signed }) => (
          <>
            <p className="muted">
              {page.total} products · Categories:{" "}
              {page.categories.join(", ") || "—"} · Brands:{" "}
              {page.brands.join(", ") || "—"}
            </p>
            {!page.products.length && (
              <Empty>No matching products. Try another search.</Empty>
            )}
            <div className="grid">
              {page.products.map((product) => (
                <article className="card product" key={product.id}>
                  {product.product_images?.[0] ? (
                    <img
                      src={
                        signed[
                          product.product_images[0].variants?.[0]?.path ||
                            product.product_images[0].path
                        ]
                      }
                      alt={product.product_images[0].alt}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="product-placeholder"
                      aria-label="Product image unavailable"
                    >
                      <Icon name="bag" size={64} />
                    </div>
                  )}
                  <p className="eyebrow">
                    {product.brand} · {product.category}
                    {!product.active ? " · Archived" : ""}
                  </p>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  {product.warranty && (
                    <p className="muted">Warranty: {product.warranty}</p>
                  )}
                  {product.variants
                    .filter((v) => v.active)
                    .map((variant) => (
                      <div className="variant" key={variant.id}>
                        <strong>{variant.label}</strong>
                        <small>
                          {variant.sku} ·{" "}
                          {Object.entries(variant.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </small>
                        <b>{money(variant.price_minor)}</b>
                        {can(profile.role, "orders") && product.active && (
                          <ActionForm
                            label="Add to order"
                            success="Added. Open New order to review."
                            submit={async (form) => {
                              add({
                                variant,
                                name: product.name,
                                quantity: z.coerce
                                  .number()
                                  .int()
                                  .min(1)
                                  .max(9999)
                                  .parse(form.get("quantity")),
                              });
                            }}
                          >
                            <Field label="Quantity">
                              <input
                                name="quantity"
                                type="number"
                                min={1}
                                max={9999}
                                step={1}
                                defaultValue={1}
                                required
                              />
                            </Field>
                          </ActionForm>
                        )}
                      </div>
                    ))}
                  {can(profile.role, "manageCatalogue") && (
                    <button
                      className="secondary"
                      onClick={() => setEditing(product)}
                    >
                      Edit product / upload image
                    </button>
                  )}
                </article>
              ))}
            </div>
            <div className="row">
              <button
                disabled={filters.page <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                Previous
              </button>
              <span>Page {filters.page}</span>
              <button
                disabled={filters.page * page.page_size >= page.total}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </Data>
    </section>
  );
}
export function Cart({
  profile,
  lines,
  setLines,
}: {
  profile: Profile;
  lines: CartLine[];
  setLines: (lines: CartLine[]) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  return (
    <section>
      <h1>Review your order</h1>
      {confirmation && (
        <p role="status" className="notice">
          {confirmation}
        </p>
      )}
      {!lines.length ? (
        <Empty>
          Your order is empty. <a href="#catalogue">Browse the catalogue</a>.
        </Empty>
      ) : (
        <>
          {lines.map((line) => (
            <article className="card" key={line.variant.id}>
              <h2>
                {line.name} · {line.variant.label}
              </h2>
              <p>
                {line.variant.sku} · {money(line.variant.price_minor)} each
              </p>
              <Field label="Quantity">
                <input
                  type="number"
                  value={line.quantity}
                  min={1}
                  max={9999}
                  step={1}
                  onChange={(e) => {
                    const quantity = Number(e.target.value);
                    if (
                      Number.isInteger(quantity) &&
                      quantity >= 1 &&
                      quantity <= 9999
                    )
                      setLines(
                        lines.map((x) => (x === line ? { ...x, quantity } : x)),
                      );
                  }}
                />
              </Field>
              <button
                className="secondary"
                onClick={() => setLines(lines.filter((x) => x !== line))}
              >
                Remove
              </button>
            </article>
          ))}
          <p>
            <strong>
              Estimated total{" "}
              {money(
                lines.reduce(
                  (sum, line) =>
                    sum +
                    BigInt(line.variant.price_minor) * BigInt(line.quantity),
                  0n,
                ),
              )}
            </strong>
          </p>
          <p className="muted">
            The database confirms current prices and product availability when
            you submit.
          </p>
          <Data
            load={async () => ({
              customers: check(
                await database()
                  .from("customers")
                  .select("*")
                  .eq("approved", true)
                  .order("shop_name")
                  .limit(500),
              ) as Customer[],
              reps:
                profile.role === "customer" || profile.role === "rep"
                  ? []
                  : (check(
                      await database()
                        .from("profiles")
                        .select("id,full_name")
                        .eq("role", "rep")
                        .eq("active", true),
                    ) as Profile[]),
            })}
          >
            {({ customers, reps }) => (
              <ActionForm
                label="Submit order"
                success="Order submitted."
                submit={async (form, key) => {
                  const customerId = id(form, "customer");
                  const result = await rpc<string>("submit_order", {
                    p_customer_id: customerId,
                    p_lines: lines.map((line) => ({
                      variant_id: line.variant.id,
                      quantity: line.quantity,
                    })),
                    p_key: key,
                    p_rep_id:
                      profile.role === "rep"
                        ? profile.id
                        : value(form, "rep") || null,
                    p_terms: z
                      .enum(["cash", "credit"])
                      .parse(form.get("terms")),
                    p_notes: value(form, "notes", 2000),
                  });
                  setConfirmation(
                    `Order submitted successfully. Reference: ${result}. View Orders for its order number.`,
                  );
                  setLines([]);
                }}
              >
                <input
                  type="hidden"
                  name="line_signature"
                  value={JSON.stringify(
                    lines.map((l) => [l.variant.id, l.quantity]),
                  )}
                />
                <Field
                  label={profile.role === "customer" ? "Your shop" : "Customer"}
                >
                  <select
                    name="customer"
                    required
                    defaultValue={customers.length === 1 ? customers[0].id : ""}
                  >
                    <option value="">Select an approved customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shop_name}
                      </option>
                    ))}
                  </select>
                </Field>
                {reps.length > 0 && (
                  <Field label="Sales representative">
                    <select name="rep">
                      <option value="">No representative</option>
                      {reps.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Payment terms">
                  <select name="terms">
                    <option value="cash">Cash</option>
                    <option value="credit">
                      Credit (subject to office policy)
                    </option>
                  </select>
                </Field>
                <Field label="Order notes">
                  <textarea name="notes" maxLength={2000} />
                </Field>
              </ActionForm>
            )}
          </Data>
        </>
      )}
    </section>
  );
}
function ProductEditor({
  product,
  saved,
}: {
  product: Product | null;
  saved: () => void;
}) {
  const [variantId, setVariantId] = useState(product?.variants[0]?.id || "");
  const variant = product?.variants.find((v) => v.id === variantId);
  return (
    <>
      <h2>{product ? "Edit catalogue" : "New product"}</h2>
      {product && (
        <Field label="Variant to edit">
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku}
              </option>
            ))}
            <option value="">Add another variant</option>
          </select>
        </Field>
      )}
      <ActionForm
        key={`${product?.id}:${variantId}`}
        label="Save product"
        onSuccess={saved}
        submit={async (form) => {
          const attributes = z
            .record(z.string(), z.string().max(200))
            .parse(JSON.parse(value(form, "attributes") || "{}"));
          const price = z
            .string()
            .regex(/^\d{1,9}(\.\d{1,2})?$/)
            .parse(value(form, "price"));
          await rpc("save_catalogue", {
            p_product_id: product?.id || null,
            p_variant_id: variant?.id || null,
            p_name: value(form, "name", 200),
            p_category: value(form, "category", 100),
            p_brand: value(form, "brand", 100),
            p_description: value(form, "description"),
            p_warranty: value(form, "warranty", 2000) || null,
            p_sku: value(form, "sku", 80),
            p_label: value(form, "label", 150),
            p_attributes: attributes,
            p_price_minor: parseMoney(price),
            p_active: form.get("active") === "on",
          });
        }}
      >
        <Field label="Product name">
          <input
            name="name"
            defaultValue={product?.name}
            required
            maxLength={200}
          />
        </Field>
        <Field label="Category">
          <input
            name="category"
            defaultValue={product?.category}
            required
            maxLength={100}
          />
        </Field>
        <Field label="Brand">
          <input
            name="brand"
            defaultValue={product?.brand}
            required
            maxLength={100}
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            defaultValue={product?.description}
            maxLength={4000}
          />
        </Field>
        <Field label="Warranty">
          <textarea
            name="warranty"
            defaultValue={product?.warranty || ""}
            maxLength={2000}
          />
        </Field>
        <Field label="SKU">
          <input
            name="sku"
            defaultValue={variant?.sku}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Variant label">
          <input
            name="label"
            defaultValue={variant?.label}
            required
            maxLength={150}
          />
        </Field>
        <Field label="Price (LKR)">
          <input
            name="price"
            inputMode="decimal"
            defaultValue={variant ? (variant.price_minor / 100).toFixed(2) : ""}
            required
            pattern="[0-9]+(\.[0-9]{1,2})?"
          />
        </Field>
        <Field label="Attributes (JSON)">
          <textarea
            name="attributes"
            defaultValue={JSON.stringify(variant?.attributes || {})}
            maxLength={4000}
          />
        </Field>
        <label className="check">
          <input
            name="active"
            type="checkbox"
            defaultChecked={product?.active ?? true}
          />
          Active (untick to archive)
        </label>
      </ActionForm>
      {product &&
        (__WEB_APP_URL__ ? (
          <ActionForm
            label="Compress and upload image"
            onSuccess={saved}
            submit={async (form) => {
              const file = form.get("image");
              if (!(file instanceof File))
                throw new Error("Select a photograph.");
              const prepared = await prepareImage(file);
              const body = new FormData();
              body.set("product_id", product.id);
              body.set("alt", value(form, "alt", 250));
              body.set("image", prepared);
              const session = check(await database().auth.getSession()).session;
              if (!session) throw new Error("Sign in again.");
              const response = await fetch(
                `${__WEB_APP_URL__}/api/mobile/catalogue-image`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${session.access_token}` },
                  body,
                },
              );
              const result = (await response.json()) as {
                ok: boolean;
                message: string;
              };
              if (!response.ok || !result.ok)
                throw new Error(result.message || "Upload failed.");
            }}
          >
            <h3>Product photograph</h3>
            <Field label="JPEG, PNG or WebP (up to 8 MB)">
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </Field>
            <Field label="Image description">
              <input name="alt" required maxLength={250} />
            </Field>
          </ActionForm>
        ) : (
          <p className="notice">
            Mobile image uploading needs MOBILE_WEB_APP_URL set to your hosted
            HTTPS website before building. You can upload images through the
            website now.
          </p>
        ))}
    </>
  );
}
