import WorkspaceHome from "@/features/auth/workspace-home";
export default function Page(props: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <WorkspaceHome {...props} />;
}
