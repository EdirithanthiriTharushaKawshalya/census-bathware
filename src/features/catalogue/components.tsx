/* Private images use short-lived, authenticated Storage URLs. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cataloguePage, productById, type CatalogueFilters } from "./queries";
import { imageSources } from "./image-delivery.server";
import { requireSession } from "@/features/auth/session";
import { can } from "@/features/auth/permissions";
import { PageTitle, Empty, Status } from "@/components/ui/shared";
import { money } from "@/features/billing/money";
import { CatalogueEditor } from "./editor";
import type { Product } from "@/types/domain";
export function ProductArt({ category }: { category: string }) {
  const shape = category.toLowerCase().includes("tap")
    ? "tap-icon"
    : category.toLowerCase().includes("shower")
      ? "shower-icon"
      : "basin-icon";
  return (
    <div
      className={`product-art ${shape}`}
      role="img"
      aria-label={`${category} illustration; product photograph pending`}
    >
      <i />
      <b />
    </div>
  );
}
function ProductImage({
  product,
  sources,
  large = false,
}: {
  product: Product;
  sources: Map<string, string>;
  large?: boolean;
}) {
  const first = product.product_images[0];
  const url = first ? sources.get(first.path) : null;
  const variants =
    first?.variants
      ?.filter((image) => sources.has(image.path))
      .sort((a, b) => a.width - b.width) || [];
  return url ? (
    <img
      src={url}
      srcSet={
        variants.length
          ? variants
              .map((image) => `${sources.get(image.path)} ${image.width}w`)
              .join(", ")
          : undefined
      }
      sizes={
        large
          ? "(max-width: 760px) 100vw, 50vw"
          : "(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
      }
      alt={first.alt}
      width={first.width || 800}
      height={first.height || 800}
      loading={large ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={large ? "high" : "auto"}
      referrerPolicy="no-referrer"
    />
  ) : (
    <ProductArt category={product.category} />
  );
}
export async function CatalogueView({
  filters,
}: {
  filters: CatalogueFilters;
}) {
  const [page, profile] = await Promise.all([
    cataloguePage(filters),
    requireSession("catalogue"),
  ]);
  const { products: filtered, categories, brands } = page;
  const sources = await imageSources(
    filtered.flatMap((p) => p.product_images.slice(0, 1)),
  );
  const pages = Math.max(1, Math.ceil(page.total / page.page_size));
  function pageUrl(number: number) {
    const params = new URLSearchParams({
      q: filters.q || "",
      category: filters.category || "",
      brand: filters.brand || "",
      page: String(number),
    });
    return `/catalogue?${params}`;
  }
  return (
    <>
      <PageTitle eyebrow="The Census collection" title="Consider every detail.">
        Explore products and trade prices for your next order.
      </PageTitle>
      <form className="filters">
        <label>
          Search products or SKU
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Basin, mixer, SKU…"
            maxLength={200}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={filters.category}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Brand
          <select name="brand" defaultValue={filters.brand}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <button className="button">Apply filters</button>
      </form>
      {!filtered.length ? (
        <Empty>
          No products match. Try another search or ask the office to add
          products.
        </Empty>
      ) : (
        <div className="catalogue-grid">
          {filtered.map((p) => (
            <Link
              className="catalogue-card"
              key={p.id}
              href={`/catalogue/${p.id}`}
            >
              <ProductImage product={p} sources={sources} />
              <div className="card-body">
                <span className="eyebrow">
                  {p.brand} / {p.category}
                </span>
                <h3>{p.name}</h3>
                <p>{p.description.slice(0, 100)}</p>
                {p.variants.length > 0 && (
                  <strong className="amount">
                    From{" "}
                    {money(Math.min(...p.variants.map((v) => v.price_minor)))}
                  </strong>
                )}{" "}
                {!p.active && <Status>Archived</Status>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <nav
        className="filters"
        aria-label="Catalogue pages"
        style={{ marginTop: 24 }}
      >
        {page.page > 1 && (
          <Link className="button secondary" href={pageUrl(page.page - 1)}>
            Previous
          </Link>
        )}
        <p className="muted">
          Page {page.page} of {pages} · {page.total} products
        </p>
        {page.page < pages && (
          <Link className="button secondary" href={pageUrl(page.page + 1)}>
            Next
          </Link>
        )}
      </nav>
      <p className="fine-print">
        Prices are confirmed when your order is submitted.
      </p>
      {can(profile.role, "manageCatalogue") && (
        <details className="details panel">
          <summary>Add a product and its first variant</summary>
          <CatalogueEditor />
        </details>
      )}
    </>
  );
}
export async function ProductView({ id }: { id: string }) {
  const [product, profile] = await Promise.all([
    productById(id),
    requireSession("catalogue"),
  ]);
  if (!product) notFound();
  const sources = await imageSources(product.product_images.slice(0, 1));
  return (
    <>
      <Link href="/catalogue" className="text-link">
        Back to catalogue
      </Link>
      <PageTitle
        eyebrow={`${product.brand} / ${product.category}`}
        title={product.name}
      />
      <div className="product-layout">
        <ProductImage product={product} sources={sources} large />
        <div>
          <p>{product.description}</p>
          {product.warranty && (
            <p>
              <strong>Warranty</strong>
              <br />
              {product.warranty}
            </p>
          )}
          <h3>Choose your variant</h3>
          <div className="stack">
            {product.variants.map((v) => (
              <div className="panel" key={v.id}>
                <h3>{v.label}</h3>
                <p>
                  {v.sku} · {money(v.price_minor)}
                </p>
                <div className="attributes">
                  {Object.entries(v.attributes).map(([k, value]) => (
                    <Status key={k}>
                      {k}: {value}
                    </Status>
                  ))}
                </div>
                <Link
                  className="button small secondary"
                  href={`/orders/new?variant=${v.id}`}
                >
                  Add to an order
                </Link>
                {can(profile.role, "manageCatalogue") && (
                  <details className="details">
                    <summary>Edit product or variant</summary>
                    <CatalogueEditor product={product} variant={v} />
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {can(profile.role, "manageCatalogue") && (
        <div className="split">
          <details className="details panel">
            <summary>Add another variant</summary>
            <CatalogueEditor product={product} />
          </details>
          <details className="details panel">
            <summary>Upload catalogue image</summary>
            <CatalogueEditor product={product} imageOnly />
          </details>
        </div>
      )}
    </>
  );
}
