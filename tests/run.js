import assert from "node:assert";
import { priorityOf, compare } from "../sources.js";
import { step, close } from "../importrun.js";
import { render } from "../app.js";

const base = {
  budget: 2, sources: { s1: 1 },
  state: { values: {}, conflicts: {}, ledger: [], applied: [] },
  events: [],
  source_error_code: "E_NO_SOURCE", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("priorityOf returns a number", () => {
  assert.strictEqual(typeof priorityOf(base.sources, "s1"), "number");
});

check("compare returns a number", () => {
  assert.strictEqual(typeof compare(1, 2), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
