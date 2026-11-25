import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/census-logo.png" },
  title: {
    default: "Census Bathware | Made for everyday living",
    template: "%s | Census Bathware",
  },
  description:
    "A considered collection of bathware. A connected workspace for our trade partners and team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Suspense
          fallback={
            <main id="main" className="container section">
              Loading Census…
            </main>
          }
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}
