import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = process.cwd();
const failures = [];
const sensitive = /(?:plaintext|passphrase|primaryKey|linkKey|keyB64|encodedKey|shareUrl)/i;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "test", "dist"].includes(entry.name) || entry.name.startsWith("."))
      return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

for (const file of ["src", "worker", "shared"].flatMap((dir) => files(join(root, dir)))) {
  if (/\.(test|spec)\./.test(file) || /routeTree\.gen\.ts$/.test(file)) continue;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const path = relative(root, file).replaceAll("\\", "/");
  const report = (node, message) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    failures.push(`${path}:${line}: ${message}`);
  };
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      /(?:crypto-js|sjcl|node:crypto)/.test(node.moduleSpecifier.getText(source))
    ) {
      report(node, "Use native WebCrypto in runtime modules.");
    }
    if (ts.isCallExpression(node)) {
      const target = node.expression.getText(source);
      const args = node.arguments.map((arg) => arg.getText(source)).join(" ");
      if (/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/.test(target)) {
        report(node, "Do not persist or retrieve note secrets in browser storage.");
      }
      if (/console\.(?:log|info|warn|error|debug)/.test(target) && sensitive.test(args)) {
        report(node, "A secret may be included in log arguments.");
      }
      if (/(?:searchParams\.(?:set|append)|sendBeacon)/.test(target) && sensitive.test(args)) {
        report(node, "A secret may leave the fragment boundary.");
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      /(?:location\.(?:search|pathname)|document\.cookie)/.test(node.left.getText(source)) &&
      sensitive.test(node.right.getText(source))
    ) {
      report(node, "A secret may be written to a URL or cookie.");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Security lint passed (static guard; runtime tests remain required).");
}
