import { useEffect, useState, type ReactNode } from "react";

export function Data<T>({
  load,
  children,
}: {
  load: () => Promise<T>;
  children: (data: T) => ReactNode;
}) {
  const [result, setResult] = useState<{ value: T } | { error: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void load()
      .then((value) => {
        if (active) setResult({ value });
      })
      .catch((error) => {
        if (active)
          setResult({
            error:
              error instanceof Error
                ? error.message
                : "Unable to load records.",
          });
      });
    return () => {
      active = false;
    };
    // Each screen owns this request; mount a new Data instance when its filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);
  if (!result)
    return (
      <div role="status" aria-busy="true" className="loading-state">
        <p>Loading your records…</p>
        <div className="loading-placeholder" />
        <div className="loading-placeholder" />
      </div>
    );
  if ("error" in result)
    return (
      <div className="notice error" role="alert">
        <p>{result.error}</p>
        <button
          onClick={() => {
            setResult(null);
            setRetry((x) => x + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  return children(result.value);
}
