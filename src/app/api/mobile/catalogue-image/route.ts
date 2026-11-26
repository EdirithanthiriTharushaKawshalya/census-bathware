import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/env/public";
import {
  mobileOriginAllowed,
  mobileUploadAllowed,
  MAX_MOBILE_UPLOAD_BODY,
} from "@/features/auth/mobile-policy";
import { storeCatalogueImage } from "@/features/catalogue/image-upload.server";
import type { Profile } from "@/types/domain";

export const runtime = "nodejs";
function headers(origin: string | null) {
  return {
    ...(mobileOriginAllowed(origin)
      ? {
          "Access-Control-Allow-Origin": origin!,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
        }
      : {}),
    Vary: "Origin",
    "Cache-Control": "private, no-store",
    "CDN-Cache-Control": "no-store",
  };
}
export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: mobileOriginAllowed(origin) ? 204 : 403,
    headers: headers(origin),
  });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const reply = (status: number, message: string) =>
    Response.json({ ok: false, message }, { status, headers: headers(origin) });
  if (!mobileOriginAllowed(origin))
    return reply(403, "Mobile origin is not allowed.");
  const config = supabaseConfig();
  if (!config)
    return reply(503, "The website is awaiting its Supabase connection.");
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token || token.length > 8192) return reply(401, "Sign in again.");
  const client = createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user)
    return reply(401, "Your session has expired. Sign in again.");
  const { data: profile } = await client
    .from("profiles")
    .select("id,full_name,role,active")
    .eq("id", user.id)
    .maybeSingle();
  if (!mobileUploadAllowed(profile as Profile | null))
    return reply(403, "Catalogue management access is required.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    return reply(415, "A multipart image upload is required.");
  if (
    Number(request.headers.get("content-length") || 0) > MAX_MOBILE_UPLOAD_BODY
  )
    return reply(413, "Upload exceeds the size limit.");
  // Bound actual bytes too: Content-Length is optional and untrusted.
  const reader = request.body?.getReader();
  if (!reader) return reply(400, "No upload body.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MOBILE_UPLOAD_BODY) {
        await reader.cancel();
        return reply(413, "Upload exceeds the size limit.");
      }
      chunks.push(new Uint8Array(value));
    }
    const body = new Blob(chunks, {
      type: request.headers.get("content-type")!,
    });
    const form = await new Response(body).formData();
    const result = await storeCatalogueImage(client, form);
    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: headers(origin),
    });
  } catch {
    return reply(400, "Invalid image upload. Try another photograph.");
  }
}
