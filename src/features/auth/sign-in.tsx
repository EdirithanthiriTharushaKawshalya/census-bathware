import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { ActionForm } from "@/components/ui/action-form";
import { signIn } from "@/features/auth/actions";
import { supabaseConfig } from "@/lib/env/public";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <div className="signin-layout">
      <aside className="signin-aside">
        <Brand />
        <div>
          <span className="eyebrow">The Census trade portal</span>
          <h1>
            Good business.
            <br />
            <em>Beautifully simple.</em>
          </h1>
          <p>
            Your products, orders, and people.
            <br />
            All in one considered workspace.
          </p>
        </div>
        <span>Made for everyday living.</span>
      </aside>
      <main id="main" className="signin-main">
        <div className="signin-card">
          <Link href="/" className="text-link">
            Back to Census
          </Link>
          <span className="eyebrow">Welcome back</span>
          <h2>Make yourself at home.</h2>
          <p>Sign in with your provisioned Census account.</p>
          {!supabaseConfig() && (
            <div className="notice">
              <strong>Connection pending</strong>
              <p>
                The portal needs its Supabase connection before you can sign in.
              </p>
              <Link href="/setup">View setup steps</Link>
            </div>
          )}
          {notice === "approval" && (
            <p role="status" className="notice">
              Sign in with an active, approved account. Contact the office if
              your account needs provisioning or approval.
            </p>
          )}
          <ActionForm action={signIn} submit="Sign in">
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
          </ActionForm>
          <p className="muted">
            Need access or a password reset? Contact your Census office
            administrator. Each person uses their own account.
          </p>
          <p className="fine-print">
            PIN access is awaiting business approval.
          </p>
        </div>
      </main>
    </div>
  );
}
