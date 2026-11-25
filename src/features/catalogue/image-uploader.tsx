"use client";
import { useActionState } from "react";
import { uploadImage } from "./actions";
import type { ActionState } from "@/types/domain";
async function prepareAndUpload(
  state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("image");
  if (!(file instanceof File))
    return { ok: false, message: "Choose a product image." };
  try {
    const { prepareImage } = await import("./image-preparation");
    form.set("image", await prepareImage(file));
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to prepare this image.",
    };
  }
  return uploadImage(state, form);
}
export function ImageUploader({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(prepareAndUpload, {
    ok: false,
    message: "",
  });
  return (
    <form className="form" action={action}>
      <input type="hidden" name="product_id" value={productId} />
      <label>
        Product photograph (up to 8 MB)
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={pending}
        />
      </label>
      <label>
        Image description
        <input name="alt" required maxLength={250} disabled={pending} />
      </label>
      <p className="muted">
        Images are resized and compressed automatically. Location and camera
        metadata are removed. The latest photograph is shown in the catalogue.
        The catalogue remains private.
      </p>
      <button className="button" disabled={pending}>
        {pending ? "Optimizing and uploading…" : "Upload image"}
      </button>
      {state.message && (
        <p
          className={`notice ${state.ok ? "success" : "error"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
