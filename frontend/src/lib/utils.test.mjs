import assert from "node:assert/strict";
import test from "node:test";
import { cn, formatDate, formatRelativeTime } from "./utils.ts";

test("cn merges class names correctly", () => {
  assert.equal(cn("px-2 py-1", "bg-blue-500"), "px-2 py-1 bg-blue-500");
  assert.equal(cn("px-2", false && "hidden", "py-1"), "px-2 py-1");
  assert.equal(cn("p-4", "p-2"), "p-2"); // tailwind-merge override
});

test("formatDate formats valid and invalid dates", () => {
  assert.equal(formatDate(null), "N/A");
  assert.equal(formatDate("invalid-date-string"), "invalid-date-string");
  const formatted = formatDate("2024-01-01T12:00:00Z");
  assert.match(formatted, /Jan 1, 2024/);
});

test("formatRelativeTime formats relative durations", () => {
  assert.equal(formatRelativeTime(null), "N/A");
  const now = new Date().toISOString();
  assert.equal(formatRelativeTime(now), "just now");
  
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(tenMinsAgo), "10m ago");

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(twoHoursAgo), "2h ago");
});
