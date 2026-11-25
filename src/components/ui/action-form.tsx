"use client";
import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/types/domain";
export function ActionForm({
  action,
  children,
  submit = "Save",
  className = "",
  confirm,
  lockOnSuccess = false,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit?: string;
  className?: string;
  confirm?: string;
  lockOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={formAction}
      className={`form ${className}`}
      onSubmit={(event) => {
        if (
          (lockOnSuccess && state.ok) ||
          (confirm && !window.confirm(confirm))
        )
          event.preventDefault();
      }}
    >
      {children}
      <button
        className="button"
        disabled={pending || (lockOnSuccess && state.ok)}
        type="submit"
      >
        {pending ? "Saving…" : lockOnSuccess && state.ok ? "Saved" : submit}
      </button>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`notice ${state.ok ? "success" : "error"}`}
        >
          {state.message}
          {state.reference && (
            <>
              {" "}
              Reference: <strong>{state.reference}</strong>
            </>
          )}
        </p>
      )}
    </form>
  );
}
