import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { guestEnquiriesEnabled } from "@/features/enquiries/queries";
import { EnquiryForm } from "@/features/enquiries/form";
export default async function Home() {
  const guest = await guestEnquiriesEnabled();
  return (
    <>
      <header className="public-header container">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#collection">Our collection</a>
          <a href="#partners">Trade partners</a>
          <Link href="/sign-in" className="button small secondary">
            Partner sign in
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-line" /> Considered design. Everyday
              comfort.
            </span>
            <h1>
              Good days
              <br />
              begin with
              <br />
              <em>better spaces.</em>
            </h1>
            <p>
              Thoughtfully selected bathware for the spaces we live in. Discover
              the details that make a bathroom feel complete.
            </p>
            <div className="hero-actions">
              <Link href="/sign-in" className="button">
                Enter the trade portal
              </Link>
              <a href="#collection" className="text-link">
                Discover Census
              </a>
            </div>
            <div className="hero-caption">
              <span className="seal">C</span>
              <span>
                For homes. For projects.
                <br />
                <strong>For the way you live.</strong>
              </span>
            </div>
          </div>
          <div
            className="bath-scene"
            role="img"
            aria-label="Architectural illustration of a contemporary bathroom with a round mirror, sculpted basin, and brass tap"
          >
            <div className="scene-light" />
            <div className="wall-lines" />
            <div className="mirror" />
            <div className="tap">
              <i />
            </div>
            <div className="basin" />
            <div className="vanity">
              <i />
              <i />
            </div>
            <div className="vase">
              <i />
              <b />
              <span />
            </div>
            <div className="scene-label">
              <span>THE CENSUS COLLECTION</span>
              <strong>Details make the difference.</strong>
            </div>
          </div>
        </section>
        <div className="value-strip">
          <div className="container">
            <span>Thoughtfully selected</span>
            <span>Made for everyday living</span>
            <span>A partner in every project</span>
          </div>
        </div>
        <section className="container section" id="collection">
          <div className="section-intro">
            <div>
              <span className="eyebrow">A space for every ritual</span>
              <h2>Find your finishing touch.</h2>
            </div>
            <p>
              From the first detail to the final fitting,
              <br />
              build a space that feels like yours.
            </p>
          </div>
          <div className="category-grid">
            {[
              {
                name: "Basins & vanities",
                sub: "Sculptural forms. Everyday function.",
                shape: "basin-icon",
              },
              {
                name: "Taps & mixers",
                sub: "A considered touch, every time.",
                shape: "tap-icon",
              },
              {
                name: "Showers & accessories",
                sub: "Small details. Lasting comfort.",
                shape: "shower-icon",
              },
            ].map((c) => (
              <Link href="/catalogue" className="category-card" key={c.name}>
                <div className={`product-art ${c.shape}`} aria-hidden="true">
                  <i />
                  <b />
                </div>
                <span className="eyebrow">Explore the collection</span>
                <h3>{c.name}</h3>
                <p>{c.sub}</p>
                <span className="text-link">View in trade portal</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="partner-section" id="partners">
          <div className="container partner-grid">
            <div>
              <span className="eyebrow">Built around your business</span>
              <h2>
                Your next order.
                <br />A little more effortless.
              </h2>
              <p>
                One workspace for our trade customers and team. Explore
                products, place orders, and keep track of the details.
              </p>
              <Link className="button light" href="/sign-in">
                Sign in to your account
              </Link>
            </div>
            <div className="partner-points">
              <article>
                <span>01</span>
                <div>
                  <h3>A catalogue that works for you</h3>
                  <p>
                    Browse variants and trade prices with your approved account.
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Clarity from order to delivery</h3>
                  <p>
                    Follow your orders, invoices, and delivery progress in one
                    place.
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>People behind every request</h3>
                  <p>Send an enquiry directly to the Census team.</p>
                </div>
              </article>
            </div>
          </div>
        </section>
        {guest && (
          <section className="container section narrow" id="enquire">
            <span className="eyebrow">Let’s talk</span>
            <h2>Tell us what you need.</h2>
            <EnquiryForm />
          </section>
        )}
      </main>
      <footer className="container public-footer">
        <Brand />
        <p>Considered bathware. Connected service.</p>
        <span>© {new Date().getFullYear()} Census Bathware</span>
      </footer>
    </>
  );
}
