import { useRef } from "react";
import type { Profile } from "@/types/domain";
import type { Capability } from "@/features/auth/permissions";
import { Icon } from "./icons";

export type Destination = {
  id: string;
  title: string;
  capability?: Capability;
};
export const descriptions: Record<string, string> = {
  catalogue: "Explore products, finishes & prices",
  cart: "Review and send your next order",
  orders: "Track orders and delivery progress",
  invoices: "Invoices, balances & payment history",
  deliveries: "Your dispatches and delivery updates",
  enquiries: "Questions and customer follow-ups",
  collections: "Customer balances & pending cheques",
  reporting: "Sales trends and team performance",
};
export function Navigation({
  allowed,
  screen,
  profile,
  count,
  signOut,
}: {
  allowed: Destination[];
  screen: string;
  profile: Profile;
  count: number;
  signOut: () => void;
}) {
  const menu = useRef<HTMLDialogElement>(null);
  const priority =
    profile.role === "customer" || profile.role === "rep"
      ? ["home", "catalogue", "orders", "cart"]
      : profile.role === "accounts"
        ? ["home", "invoices", "collections", "reporting"]
        : ["home", "catalogue", "orders", "deliveries"];
  const primary = priority.flatMap((id) =>
    allowed.filter((tab) => tab.id === id),
  );
  const secondaryActive = !primary.some((tab) => tab.id === screen);
  return (
    <>
      <nav className="bottom-nav" aria-label="Main navigation">
        {primary.map((tab) => (
          <a
            href={`#${tab.id}`}
            key={tab.id}
            aria-current={screen === tab.id ? "page" : undefined}
          >
            <span className="nav-icon">
              <Icon name={tab.id} />
              {tab.id === "cart" && count > 0 && (
                <b className="count-badge">{count}</b>
              )}
            </span>
            <span>{tab.title}</span>
          </a>
        ))}
        <button
          type="button"
          onClick={() => menu.current?.showModal()}
          aria-label="More sections"
          aria-haspopup="dialog"
          className={secondaryActive ? "selected" : ""}
        >
          <Icon name="more" />
          <span>More</span>
        </button>
      </nav>
      <dialog
        ref={menu}
        className="menu-sheet"
        aria-labelledby="sections-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) menu.current?.close();
        }}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2 id="sections-title">All sections</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close menu"
            onClick={() => menu.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="menu-profile">
          <span className="profile-avatar">{profile.full_name.charAt(0)}</span>
          <div>
            <strong>{profile.full_name}</strong>
            <span>
              {profile.role === "rep" ? "Sales representative" : profile.role}
            </span>
          </div>
        </div>
        <nav aria-label="All sections" className="section-menu">
          {allowed.map((tab) => (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              onClick={() => menu.current?.close()}
              aria-current={screen === tab.id ? "page" : undefined}
            >
              <span className="module-icon">
                <Icon name={tab.id} />
              </span>
              <span>{tab.title}</span>
              <Icon name="chevron" size={17} />
            </a>
          ))}
        </nav>
        <button
          className="logout-button"
          onClick={() => {
            menu.current?.close();
            signOut();
          }}
        >
          <Icon name="logout" />
          Sign out
        </button>
      </dialog>
    </>
  );
}
export function Home({
  profile,
  allowed,
}: {
  profile: Profile;
  allowed: Destination[];
}) {
  const lead =
    profile.role === "delivery"
      ? "deliveries"
      : profile.role === "accounts"
        ? "invoices"
        : "catalogue";
  const action = allowed.find((tab) => tab.id === lead);
  return (
    <section className="home-screen">
      <div className="home-greeting">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat("en", {
              weekday: "long",
              month: "short",
              day: "numeric",
            }).format(new Date())}
          </p>
          <h1>
            Hello, {profile.full_name.split(" ")[0]}
            <span>.</span>
          </h1>
          <p>Let’s make today a good day.</p>
        </div>
        <span className="profile-avatar">{profile.full_name.charAt(0)}</span>
      </div>
      {action && (
        <a className="home-feature" href={`#${action.id}`}>
          <span className="feature-kicker">
            {profile.role === "customer"
              ? "MADE FOR YOUR SHOP"
              : "YOUR DAY, ORGANIZED"}
          </span>
          <h2>
            {profile.role === "delivery"
              ? "Your next delivery starts here."
              : profile.role === "accounts"
                ? "A clear view of every payment."
                : "Great spaces begin with the right details."}
          </h2>
          <span className="feature-cta">
            {action.title === "Catalogue"
              ? "Explore catalogue"
              : `View ${action.title.toLowerCase()}`}
            <Icon name="arrow" size={19} />
          </span>
          <span className="feature-art" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </a>
      )}
      <div className="section-label">
        <h2>Quick access</h2>
        <span>Made for your day</span>
      </div>
      <div className="quick-grid">
        {allowed
          .filter((tab) =>
            ["orders", "cart", "deliveries", "invoices"].includes(tab.id),
          )
          .slice(0, 4)
          .map((tab) => (
            <a key={tab.id} href={`#${tab.id}`}>
              <span className="module-icon">
                <Icon name={tab.id} />
              </span>
              <strong>{tab.title}</strong>
              <span>
                {tab.id === "cart" ? "Start an order" : "View records"}
                <Icon name="arrow" size={14} />
              </span>
            </a>
          ))}
      </div>
      <div className="section-label">
        <h2>Your workspace</h2>
        <span>
          {profile.role === "rep" ? "Sales representative" : profile.role}
        </span>
      </div>
      <div className="workspace-list">
        {allowed
          .filter((tab) => tab.id !== "home" && tab.id !== "cart")
          .map((tab) => (
            <a key={tab.id} href={`#${tab.id}`}>
              <span className="module-icon">
                <Icon name={tab.id} />
              </span>
              <div>
                <strong>{tab.title}</strong>
                <p>{descriptions[tab.id]}</p>
              </div>
              <Icon name="chevron" size={18} />
            </a>
          ))}
      </div>
      <p className="workspace-note">
        <Icon name="shield" size={15} />
        Your workspace stays in sync with Census.
      </p>
    </section>
  );
}
