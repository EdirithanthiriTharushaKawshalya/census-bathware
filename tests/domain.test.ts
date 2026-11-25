import assert from "node:assert/strict";
import { test } from "node:test";
import { can, assignedDelivery } from "../src/features/auth/permissions";
import {
  balance,
  money,
  parseMoney,
  snapshotTotal,
} from "../src/features/billing/money";
import { orderInput, uniqueVariants } from "../src/features/orders/validation";
test("customer and delivery roles cannot record payments or manage catalogue", () => {
  for (const role of ["customer", "delivery", "rep"] as const) {
    assert.equal(can(role, "billing"), false);
    assert.equal(can(role, "manageCatalogue"), false);
  }
  assert.equal(can("accounts", "billing"), true);
  assert.equal(can("delivery", "catalogue"), false);
  assert.equal(can("office", "manageCatalogue"), true);
});
test("delivery updates require assignment or an authorized office role", () => {
  assert.equal(assignedDelivery({ id: "a", role: "delivery" }, "b"), false);
  assert.equal(assignedDelivery({ id: "a", role: "delivery" }, "a"), true);
  assert.equal(assignedDelivery({ id: "a", role: "rep" }, "a"), false);
  assert.equal(assignedDelivery({ id: "a", role: "office" }, "b"), true);
});
test("balances count cleared money only, not pending, bounced, or void payments", () => {
  assert.equal(
    balance(10000, [
      { amount_minor: 1500, method: "cash", state: "cleared" },
      { amount_minor: 2000, method: "cheque", state: "pending" },
      { amount_minor: 1000, method: "cheque", state: "cleared" },
      { amount_minor: 3000, method: "cash", state: "void" },
      { amount_minor: 800, method: "cheque", state: "bounced" },
    ]),
    7500,
  );
});
test("monetary input converts decimal text exactly into minor units", () => {
  assert.ok(money("900719925474099129").endsWith("9,007,199,254,740,991.29"));
  assert.ok(money(29).endsWith("0.29"));
  assert.equal(parseMoney("0.29"), 29);
  assert.equal(parseMoney("105.5"), 10550);
  assert.equal(parseMoney("100000.01"), 10000001);
  assert.throws(() => parseMoney("1.001"));
  assert.throws(() => parseMoney("-2"));
});
test("invoice snapshot values remain independent of live catalogue prices", () => {
  const catalogue = { price_minor: 1850000 };
  const snapshot = { quantity: 3, unit_price_minor: catalogue.price_minor };
  catalogue.price_minor = 2000000;
  assert.equal(snapshotTotal([snapshot]), 5550000);
});
test("order validation rejects duplicate variants, invalid quantities, and client prices", () => {
  const id = "20000000-0000-4000-8000-000000000001";
  assert.equal(uniqueVariants([{ variant_id: id }, { variant_id: id }]), false);
  const input = {
    customer_id: id,
    terms: "cash",
    notes: "",
    key: id,
    lines: [{ variant_id: id, quantity: 2, unit_price_minor: 1 }],
  };
  const parsed = orderInput.parse(input);
  assert.equal("unit_price_minor" in parsed.lines[0], false);
  assert.equal(
    orderInput.safeParse({ ...input, lines: [{ variant_id: id, quantity: 0 }] })
      .success,
    false,
  );
});
