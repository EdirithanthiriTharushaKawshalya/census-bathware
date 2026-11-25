import { notFound } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { DemoOverview } from "@/features/reporting/demo";
export const dynamic = "force-dynamic";
export default function Demo() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <>
      <div className="demo-ribbon">
        Development-only preview · Fictional data · Read only
      </div>
      <header className="public-header container">
        <Brand />
        <Link className="button small secondary" href="/">
          Public site
        </Link>
      </header>
      <main id="main" className="container section">
        <DemoOverview />
      </main>
    </>
  );
}
