import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container section">
      <span className="eyebrow">404 / Census Bathware</span>
      <h1>A little off track.</h1>
      <p>We couldn’t find that page.</p>
      <Link className="button" href="/">
        Back to Census
      </Link>
    </main>
  );
}
