export function sessionCookieOptions(
  production = process.env.NODE_ENV === "production",
) {
  return { path: "/", sameSite: "lax" as const, secure: production };
}
