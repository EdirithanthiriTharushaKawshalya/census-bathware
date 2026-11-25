import Link from "next/link";
import { requireSession } from "@/features/auth/session";
import { can } from "@/features/auth/permissions";
import { PageTitle } from "@/components/ui/shared";
export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const profile = await requireSession();
  const { notice } = await searchParams;
  return (
    <>
      <PageTitle
        eyebrow="Your Census workspace"
        title={`Welcome, ${profile.full_name.split(" ")[0]}.`}
      >
        Everything you need for the day ahead.
      </PageTitle>
      {notice === "denied" && (
        <p className="notice error" role="alert">
          Your role does not have access to that area.
        </p>
      )}
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">Made for everyday business</span>
          <h2>
            A little more clarity.
            <br />A lot more possibility.
          </h2>
          <p>
            Your workspace shows only the records your account is permitted to
            access.
          </p>
        </div>
        <div className="welcome-symbol" aria-hidden="true">
          c
        </div>
      </div>
      <div className="dashboard-grid">
        {can(profile.role, "catalogue") && (
          <Link className="panel feature-card" href="/catalogue">
            <span className="eyebrow">Discover</span>
            <h3>The collection</h3>
            <p>Explore products, finishes, and trade prices.</p>
            <span className="text-link">Browse catalogue</span>
          </Link>
        )}
        {can(profile.role, "orders") && (
          <Link className="panel feature-card" href="/orders">
            <span className="eyebrow">Keep things moving</span>
            <h3>Your orders</h3>
            <p>Place an order or follow its progress.</p>
            <span className="text-link">Open orders</span>
          </Link>
        )}
        {can(profile.role, "deliveries") && (
          <Link className="panel feature-card" href="/workspace/deliveries">
            <span className="eyebrow">On the road</span>
            <h3>Delivery queue</h3>
            <p>Open assigned stops and record fulfilment.</p>
            <span className="text-link">View deliveries</span>
          </Link>
        )}
        {can(profile.role, "collections") && (
          <Link className="panel feature-card" href="/workspace/collections">
            <span className="eyebrow">Stay informed</span>
            <h3>Customer balances</h3>
            <p>Review outstanding invoices and collections.</p>
            <span className="text-link">View collections</span>
          </Link>
        )}
        {can(profile.role, "enquiries") && (
          <Link className="panel feature-card" href="/enquiries">
            <span className="eyebrow">Stay connected</span>
            <h3>Enquiries</h3>
            <p>A direct line to the next conversation.</p>
            <span className="text-link">Open enquiries</span>
          </Link>
        )}
      </div>
    </>
  );
}
