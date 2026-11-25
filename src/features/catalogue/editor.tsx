import { ActionForm } from "@/components/ui/action-form";
import { saveProduct } from "./actions";
import { ImageUploader } from "./image-uploader";
import type { Product, Variant } from "@/types/domain";
export function CatalogueEditor({
  product,
  variant,
  imageOnly = false,
}: {
  product?: Product;
  variant?: Variant;
  imageOnly?: boolean;
}) {
  if (imageOnly && product) return <ImageUploader productId={product.id} />;
  return (
    <ActionForm
      action={saveProduct}
      submit={product ? "Save catalogue changes" : "Create product"}
    >
      <input name="product_id" type="hidden" value={product?.id || ""} />
      <input name="variant_id" type="hidden" value={variant?.id || ""} />
      <div className="form-grid">
        <label>
          Product name
          <input
            name="name"
            defaultValue={product?.name}
            required
            maxLength={200}
          />
        </label>
        <label>
          Category
          <input
            name="category"
            defaultValue={product?.category}
            required
            maxLength={100}
          />
        </label>
        <label>
          Brand
          <input
            name="brand"
            defaultValue={product?.brand}
            required
            maxLength={100}
          />
        </label>
        <label>
          Unique SKU
          <input
            name="sku"
            defaultValue={variant?.sku}
            required
            maxLength={80}
          />
        </label>
        <label>
          Variant label
          <input
            name="label"
            defaultValue={variant?.label}
            required
            maxLength={150}
          />
        </label>
        <label>
          Trade price (LKR)
          <input
            name="price"
            inputMode="decimal"
            defaultValue={variant ? (variant.price_minor / 100).toFixed(2) : ""}
            required
            pattern="[0-9]+(\.[0-9]{1,2})?"
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={product?.description}
          maxLength={4000}
        />
      </label>
      <label>
        Warranty, if confirmed
        <textarea
          name="warranty"
          defaultValue={product?.warranty || ""}
          maxLength={2000}
        />
      </label>
      <label>
        Variant attributes (JSON)
        <textarea
          name="attributes"
          defaultValue={JSON.stringify(variant?.attributes || {}, null, 2)}
          maxLength={4000}
        />
      </label>
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={product?.active ?? true}
        />
        Product active (uncheck to archive all its variants)
      </label>
      <p className="muted">
        Prices and descriptions on existing orders and invoices are preserved.
      </p>
    </ActionForm>
  );
}
