import test from "node:test";
import assert from "node:assert/strict";
import {
  mobileOriginAllowed,
  mobileUploadAllowed,
} from "../src/features/auth/mobile-policy";
import { roles } from "../src/types/domain";

test("native image API accepts only the configured native origins", () => {
  for (const origin of ["https://localhost", "capacitor://localhost"])
    assert.equal(mobileOriginAllowed(origin), true);
  for (const origin of [
    null,
    "null",
    "https://evil.example",
    "http://localhost",
    "https://localhost.evil.example",
    "capacitor://localhost/",
  ])
    assert.equal(mobileOriginAllowed(origin), false);
});
test("image API requires an active catalogue management role", () => {
  assert.equal(mobileUploadAllowed(null), false);
  for (const role of roles) {
    assert.equal(
      mobileUploadAllowed({
        id: "test",
        full_name: "Test",
        role,
        active: true,
      }),
      ["office", "management", "admin"].includes(role),
    );
    assert.equal(
      mobileUploadAllowed({
        id: "test",
        full_name: "Test",
        role,
        active: false,
      }),
      false,
    );
  }
});
