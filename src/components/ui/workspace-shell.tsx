import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { can, type Capability } from "@/features/auth/permissions";
import { signOut } from "@/features/auth/actions";
import type { Profile } from "@/types/domain";
const links: { href: string; label: string; cap?: Capability }[] = [
  { href: "/workspace", label: "Overview" },
  { href: "/catalogue", label: "Catalogue", cap: "catalogue" },
  { href: "/orders", label: "Orders", cap: "orders" },
  { href: "/enquiries", label: "Enquiries", cap: "enquiries" },
  { href: "/workspace/billing", label: "Invoices & payments", cap: "billing" },
  { href: "/workspace/deliveries", label: "Deliveries", cap: "deliveries" },
  { href: "/workspace/collections", label: "Collections", cap: "collections" },
  { href: "/workspace/reporting", label: "Reports", cap: "reporting" },
];
export function WorkspaceShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow">Partner workspace</span>
        <nav aria-label="Workspace">
          {links
            .filter((link) => !link.cap || can(profile.role, link.cap))
            .map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{profile.full_name.slice(0, 1)}</span>
          <div>
            <strong>{profile.full_name}</strong>
            <span>{profile.role}</span>
          </div>
        </div>
        <form action={signOut}>
          <button className="text-link" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <div className="workspace-content">
        <header className="workspace-header">
          <span>CENSUS / TRADE PORTAL</span>
          <span className="badge">{profile.role}</span>
        </header>
        <main id="main" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          Census Bathware · A considered way to work.
        </footer>
      </div>
    </div>
  );
}
