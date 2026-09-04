import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["src", "public", "index.html"];
const extensions = new Set([".ts", ".tsx", ".css", ".html", ".json"]);
const forbidden = [
  [/\u2014/g, "em dash"],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "emoji"],
  [/\beyebrow\b/gi, "eyebrow pattern"],
  [/linear-gradient|radial-gradient|conic-gradient/gi, "gradient"],
  [/#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi, "color"],
];
const allowedColors = new Set(["#000", "#000000", "#fff", "#ffffff", "#c1121f"]);
const errors = [];

function visit(path) {
  const entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (extensions.has(extname(target))) inspect(target);
  }
}

function inspect(path) {
  const source = readFileSync(path, "utf8");
  for (const [pattern, label] of forbidden) {
    for (const match of source.matchAll(pattern)) {
      if (label === "color" && allowedColors.has(match[0].toLowerCase())) continue;
      errors.push(`${path}: forbidden ${label}: ${match[0]}`);
    }
  }
}

for (const root of roots) {
  if (root.includes(".")) inspect(root);
  else visit(root);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Visual and copy audit passed.");
