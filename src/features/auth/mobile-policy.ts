import { can } from "./permissions";
import { roles, type Profile } from "@/types/domain";

const origins = new Set(["https://localhost", "capacitor://localhost"]);
export function mobileOriginAllowed(origin: string | null) {
  return origin !== null && origins.has(origin);
}
export function mobileUploadAllowed(profile: Profile | null) {
  return Boolean(
    profile?.active &&
    roles.includes(profile.role) &&
    can(profile.role, "manageCatalogue"),
  );
}
export const MAX_MOBILE_UPLOAD_BODY = 9 * 1024 * 1024;
