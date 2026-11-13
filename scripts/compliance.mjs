import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const failures = [];
const required = [
  ".kiro/specs/cryptoscroll.md",
  ".kiro/steering/zero-knowledge-principles.md",
  ".kiro/steering/kiroween-category.md",
  ".kiro/hooks/post-save-security-lint.sh",
  ".kiro/hooks/pre-commit-compliance.sh",
  ".kiro/hooks/security.json",
  ".kiro/hooks/compliance.json",
];

if (!existsSync("LICENSE") || !readFileSync("LICENSE", "utf8").includes("MIT License")) {
  failures.push("Missing MIT LICENSE at repository root.");
}
for (const file of required) {
  if (!existsSync(file) || readFileSync(file, "utf8").trim().length < 80) {
    failures.push(`Missing or empty artifact: ${file}`);
  }
}
const ignored = spawnSync("git", ["check-ignore", "--no-index", "--", ...required], {
  encoding: "utf8",
});
if (ignored.status === 0) failures.push(`Kiro artifacts are ignored: ${ignored.stdout.trim()}`);
else if (ignored.status !== 1) failures.push("Could not verify Git ignore rules.");

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "test"].includes(entry.name) || entry.name.startsWith("."))
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (/\.(ts|tsx|js|json|toml)$/.test(path) && !/\.(test|spec)\./.test(path)) {
      const source = readFileSync(path, "utf8");
      if (/\b(?:API_KEY|SECRET_KEY|PASSWORD)\s*[:=]\s*["'][^"'\r\n]{8,}["']/.test(source)) {
        failures.push(`Possible hardcoded credential in ${path} (value withheld).`);
      }
    }
  }
}
for (const directory of ["src", "worker", "shared"]) inspect(directory);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Compliance passed: MIT license, visible Kiro artifacts, no detected credential literals.",
  );
  console.log(
    "Repository visibility, actual Kiro usage and submission evidence require separate verification.",
  );
}
