import Link from "next/link";
import type { ReactNode } from "react";
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Status({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function SetupState() {
  return (
    <main id="main" className="container section narrow">
      <span className="eyebrow">Connection required</span>
      <h1>
        A home for your
        <br />
        next chapter.
      </h1>
      <p>
        The Census trade portal is ready for its Supabase connection. Sign-in
        and business records become available after setup.
      </p>
      <div className="panel">
        <h2>Connect your workspace</h2>
        <ol>
          <li>Copy .env.example to .env.local.</li>
          <li>Add your Supabase project URL and publishable key.</li>
          <li>
            Apply the migrations and provision approved accounts using the
            README.
          </li>
          <li>Restart the app and sign in.</li>
        </ol>
        <p>No credentials are needed to explore the public site.</p>
      </div>
      <Link href="/" className="button secondary">
        Back to Census
      </Link>
    </main>
  );
}
