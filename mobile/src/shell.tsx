import { lazy, Suspense, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { can, type Capability } from "@/features/auth/permissions";
import type { Profile } from "@/types/domain";
import logo from "../../public/census-favicon.png";
import { actor, database, db, rpc } from "./client";
import { ActionForm, Field, value } from "./ui";
import { Navigation, Home } from "./navigation";
import { Icon } from "./icons";
import type { CartLine } from "./catalogue";

const Catalogue = lazy(() =>
  import("./catalogue").then((m) => ({ default: m.Catalogue })),
);
const Cart = lazy(() =>
  import("./catalogue").then((m) => ({ default: m.Cart })),
);
const Orders = lazy(() =>
  import("./orders").then((m) => ({ default: m.Orders })),
);
const Invoices = lazy(() =>
  import("./orders").then((m) => ({ default: m.Invoices })),
);
const Deliveries = lazy(() =>
  import("./operations").then((m) => ({ default: m.Deliveries })),
);
const Enquiries = lazy(() =>
  import("./operations").then((m) => ({ default: m.Enquiries })),
);
const Reports = lazy(() =>
  import("./operations").then((m) => ({ default: m.Reports })),
);

const tabs: { id: string; title: string; capability?: Capability }[] = [
  { id: "home", title: "Overview" },
  { id: "catalogue", title: "Catalogue", capability: "catalogue" },
  { id: "cart", title: "New order", capability: "orders" },
  { id: "orders", title: "Orders", capability: "orders" },
  { id: "invoices", title: "Invoices" },
  { id: "deliveries", title: "Deliveries", capability: "deliveries" },
  { id: "enquiries", title: "Enquiries", capability: "enquiries" },
  { id: "collections", title: "Collections", capability: "collections" },
  { id: "reporting", title: "Sales reports", capability: "reporting" },
];
export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState(location.hash.slice(1) || "home");
  const [online, setOnline] = useState(navigator.onLine);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [authError, setAuthError] = useState("");
  const [revision, setRevision] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const listeners = [
      Network.addListener("networkStatusChange", (status) =>
        setOnline(status.connected),
      ),
      NativeApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          db?.auth.startAutoRefresh();
          void db?.auth.getSession().then(({ data }) => {
            if (data.session)
              void actor()
                .then(setProfile)
                .catch(() => {
                  setProfile(null);
                  setCart([]);
                  void db?.auth.signOut({ scope: "local" });
                  setAuthError(
                    "Your session ended or account access changed. Please sign in again.",
                  );
                });
          });
        } else db?.auth.stopAutoRefresh();
      }),
    ];
    if (Capacitor.isNativePlatform()) {
      listeners.push(
        NativeApp.addListener("backButton", () => {
          const dialog =
            document.querySelector<HTMLDialogElement>("dialog[open]");
          if (dialog) {
            dialog.close();
            return;
          }
          if (location.hash && location.hash !== "#home")
            location.hash = "home";
          else void NativeApp.exitApp();
        }),
      );
      void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      void SplashScreen.hide().catch(() => {});
    }
    const subscription = db?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setCart([]);
      }
    });
    const navigate = () => {
      setScreen(location.hash.slice(1) || "home");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", navigate);
    return () => {
      for (const listener of listeners)
        void listener.then((handle) => handle.remove());
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("hashchange", navigate);
    };
  }, []);
  const refresh = () => {
    setNotice("Saved successfully. Records refreshed.");
    setRevision((x) => x + 1);
  };
  const allowed = tabs.filter(
    (tab) =>
      (tab.id !== "invoices" ||
        profile?.role === "customer" ||
        (profile && can(profile.role, "billing"))) &&
      (!tab.capability || (profile && can(profile.role, tab.capability))),
  );
  return (
    <div className={profile ? "app-shell signed-in" : "app-shell signed-out"}>
      <header className="app-header">
        <img src={logo} alt="Census Bathware" />
        <div>
          <strong>
            Census<span> BATHWARE</span>
          </strong>
          <small>
            {profile
              ? `${profile.full_name} · ${profile.role}`
              : "Your trade partner, wherever you are"}
          </small>
        </div>
        {profile && (
          <button
            className="header-signout"
            onClick={async () => {
              await db?.auth.signOut({ scope: "local" });
              setProfile(null);
              setCart([]);
              location.hash = "home";
            }}
          >
            Sign out
          </button>
        )}
      </header>
      {!online && (
        <p className="notice error" role="status">
          You are offline. Connect to load records and save changes.
        </p>
      )}
      <main id="mobile-main">
        {!db ? (
          <section className="card">
            <h1>Mobile app setup</h1>
            <p>
              Build this app with the Supabase URL and public key in .env.local.
              No server secrets belong in the app.
            </p>
          </section>
        ) : !profile ? (
          <section className="login">
            <div className="login-welcome">
              <p className="eyebrow">YOUR CENSUS WORKSPACE</p>
              <h1>Welcome back.</h1>
              <p>Good to have you here. Sign in to your trade account.</p>
            </div>
            <div className="login-form">
              {authError && (
                <p role="alert" className="notice error">
                  {authError}
                </p>
              )}
              <ActionForm
                label="Sign in"
                success="Signed in."
                submit={async (form) => {
                  const email = value(form, "email", 254).toLowerCase();
                  if (
                    !(await rpc<boolean>("allow_sign_in", { p_email: email }))
                  )
                    throw new Error(
                      "Too many attempts. Wait a minute and try again.",
                    );
                  const { error } = await database().auth.signInWithPassword({
                    email,
                    password: String(form.get("password") || ""),
                  });
                  if (error)
                    throw new Error(
                      "Unable to sign in. Check your email and password.",
                    );
                  try {
                    const next = await actor();
                    setAuthError("");
                    setProfile(next);
                    location.hash = "home";
                  } catch (error) {
                    await database().auth.signOut({ scope: "local" });
                    throw error;
                  }
                }}
              >
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>
                <div className="password-field">
                  <Field label="Password">
                    <input
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      required
                      maxLength={128}
                      autoComplete="current-password"
                    />
                  </Field>
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((value) => !value)}
                  >
                    <Icon name="eye" size={20} />
                  </button>
                </div>
              </ActionForm>
              <p className="login-help">
                Need access? Contact the Census office.
              </p>
            </div>
            <p className="login-security">
              <Icon name="shield" size={16} />
              Secure access. Your business, protected.
            </p>
          </section>
        ) : (
          <>
            {notice && (
              <div role="status" className="notice notice-with-action">
                <span>{notice}</span>
                <button className="secondary" onClick={() => setNotice("")}>
                  Dismiss
                </button>
              </div>
            )}
            {!allowed.some((tab) => tab.id === screen) ? (
              <section className="card">
                <h1>Access unavailable</h1>
                <p>Your role does not have access to this screen.</p>
                <a href="#home">Go to overview</a>
              </section>
            ) : screen === "home" ? (
              <Home profile={profile} allowed={allowed} />
            ) : (
              <Suspense fallback={<p role="status">Loading screen…</p>}>
                <div key={`${screen}:${revision}:${profile.id}`}>
                  {screen === "catalogue" && (
                    <Catalogue
                      profile={profile}
                      add={(line) => {
                        setCart((current) => {
                          const old = current.find(
                            (x) => x.variant.id === line.variant.id,
                          );
                          return old
                            ? current.map((x) =>
                                x === old
                                  ? {
                                      ...x,
                                      quantity: Math.min(
                                        9999,
                                        x.quantity + line.quantity,
                                      ),
                                    }
                                  : x,
                              )
                            : [...current, line];
                        });
                      }}
                    />
                  )}
                  {screen === "cart" && (
                    <Cart profile={profile} lines={cart} setLines={setCart} />
                  )}
                  {screen === "orders" && (
                    <Orders profile={profile} refresh={refresh} />
                  )}
                  {screen === "invoices" && (
                    <Invoices profile={profile} refresh={refresh} />
                  )}
                  {screen === "deliveries" && (
                    <Deliveries profile={profile} refresh={refresh} />
                  )}
                  {screen === "enquiries" && (
                    <Enquiries profile={profile} refresh={refresh} />
                  )}
                  {(screen === "collections" || screen === "reporting") && (
                    <Reports collections={screen === "collections"} />
                  )}
                </div>
              </Suspense>
            )}
          </>
        )}
      </main>
      {profile && (
        <Navigation
          allowed={allowed}
          screen={screen}
          profile={profile}
          count={cart.length}
          signOut={() => {
            void db?.auth.signOut({ scope: "local" });
            setProfile(null);
            setCart([]);
            location.hash = "home";
          }}
        />
      )}
      {!profile && (
        <footer>Census Bathware · Thoughtfully made. Simply managed.</footer>
      )}
    </div>
  );
}
