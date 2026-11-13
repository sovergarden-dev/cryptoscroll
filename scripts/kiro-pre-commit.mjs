import { spawnSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const event = JSON.parse(input || "{}");
const containsCommit = (value) => {
  if (typeof value === "string") return /\bgit\s+(?:-[^\s]+\s+[^\s]+\s+)*commit\b/.test(value);
  if (value && typeof value === "object") return Object.values(value).some(containsCommit);
  return false;
};
if (containsCommit(event.tool_input ?? event.toolInput ?? event)) {
  for (const script of ["scripts/security-lint.mjs", "scripts/compliance.mjs"]) {
    const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
