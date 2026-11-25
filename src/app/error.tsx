"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container section narrow">
      <span className="eyebrow">Something needs attention</span>
      <h1>Let’s try that again.</h1>
      <p>
        We couldn’t load this page. If the portal was just connected, check that
        the migrations and account provisioning are complete.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
