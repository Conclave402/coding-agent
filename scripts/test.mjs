// Run the qualifier tests on the Node that is installed.
// Node 22.6 and later strip TypeScript types natively, so `npm test` works with no
// install there. Node 20 and 21 need the tsx loader, which is the one devDependency,
// so the same command works after `npm install`. FORCE_TSX=1 exercises that path.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
for (const task of ["Q1", "Q2", "Q3", "Q4", "Q5"]) {
  for (const name of readdirSync(join(root, "qualifier", task))) {
    if (name.endsWith(".test.ts")) files.push(join("qualifier", task, name));
  }
}
files.push(join("qualifier", "transcript.test.ts"));

const [major, minor] = process.versions.node.split(".").map(Number);
const native = major > 22 || (major === 22 && minor >= 6) || major === 23;
const loader = process.env.FORCE_TSX === "1" || !native ? ["--import", "tsx"] : [];
const args = [...loader, "--test", ...files];
console.log(`node ${process.versions.node}: ${args.join(" ")}`);
const run = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
process.exit(run.status ?? 1);
