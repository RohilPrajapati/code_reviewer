const assert = require("node:assert/strict");
const test = require("node:test");
const { clsx } = require("clsx");
const { twMerge } = require("tailwind-merge");

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

test("cn merges class names and handles Tailwind overrides", () => {
  assert.equal(cn("px-2 py-1", "bg-blue-500"), "px-2 py-1 bg-blue-500");
  assert.equal(cn("px-2", false && "hidden", "py-1"), "px-2 py-1");
  assert.equal(cn("p-4", "p-2"), "p-2");
});

test("formatDate handles timestamps and nulls", () => {
  assert.equal(formatDate(null), "N/A");
  assert.equal(formatDate("invalid-date-string"), "invalid-date-string");
  const formatted = formatDate("2024-01-01T12:00:00Z");
  assert.match(formatted, /Jan 1, 2024/);
});

test("formatRelativeTime computes humanized relative durations", () => {
  assert.equal(formatRelativeTime(null), "N/A");
  const now = new Date().toISOString();
  assert.equal(formatRelativeTime(now), "just now");

  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(tenMinsAgo), "10m ago");

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(twoHoursAgo), "2h ago");
});
