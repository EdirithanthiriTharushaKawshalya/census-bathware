export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  // A secret/service-role key must never be accepted as public configuration.
  if (!key.startsWith("sb_publishable_")) {
    try {
      if (
        JSON.parse(
          atob(
            (key.split(".")[1] || "").replaceAll("-", "+").replaceAll("_", "/"),
          ),
        ).role !== "anon"
      )
        return null;
    } catch {
      return null;
    }
  }
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && local)) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}
