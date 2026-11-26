import { useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  children = "No records found.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="bag" size={26} />
      </span>
      <p>{children}</p>
    </div>
  );
}
export function ActionForm({
  children,
  submit,
  label = "Save",
  success = "Saved.",
  onSuccess,
}: {
  children: ReactNode;
  submit: (form: FormData, key: string) => Promise<unknown>;
  label?: string;
  success?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  return (
    <form
      className="action-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (inFlight.current) return;
        if (!navigator.onLine) {
          setError(true);
          setMessage("You are offline. Connect and try again.");
          return;
        }
        const form = new FormData(event.currentTarget);
        const signature = JSON.stringify(
          [...form.entries()].map(([k, v]) => [
            k,
            typeof v === "string" ? v : [v.name, v.size, v.lastModified],
          ]),
        );
        if (attempt.current?.signature !== signature)
          attempt.current = { signature, key: crypto.randomUUID() };
        inFlight.current = true;
        setBusy(true);
        setMessage("");
        try {
          const result = await submit(form, attempt.current.key);
          setError(false);
          setMessage(
            typeof result === "string" && result
              ? `${success} Reference: ${result}`
              : success,
          );
          attempt.current = null;
          onSuccess?.();
        } catch (caught) {
          setError(true);
          setMessage(
            caught instanceof Error
              ? caught.message
              : "Unable to save. Please try again.",
          );
        } finally {
          inFlight.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <div className="form-actions">
          <button type="submit">{busy ? "Please wait…" : label}</button>
        </div>
      </fieldset>
      {message && (
        <p
          className={error ? "notice error" : "notice"}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
export function value(form: FormData, name: string, max = 4000) {
  const value = form.get(name) ?? "";
  if (typeof value !== "string" || value.trim().length > max)
    throw new Error(
      `Check ${name.replaceAll("_", " ")} (maximum ${max} characters).`,
    );
  return value.trim();
}
export function id(form: FormData, name: string) {
  const result = value(form, name);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new Error(`Select a valid ${name}.`);
  return result;
}
export function today() {
  return new Date().toISOString().slice(0, 10);
}
