import type { ReactNode } from "react";
import { requireSession } from "@/features/auth/session";
import { WorkspaceShell } from "@/components/ui/workspace-shell";
export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireSession();
  return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
