import { readFileSync } from "node:fs";
import process from "node:process";

function fail(message) {
  process.stderr.write(`Release version check failed: ${message}\n`);
  process.exit(1);
}

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag) {
  fail("pass a version tag such as v1.0.0");
}

const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
if (!match) {
  fail(`tag "${tag}" is not a supported v<semver> release tag`);
}

const expectedVersion = match[1];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const tauriConfig = JSON.parse(
  readFileSync("src-tauri/tauri.conf.json", "utf8"),
);
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoToml.match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];

const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json root package", packageLock.packages?.[""]?.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", cargoVersion],
]);

for (const [source, version] of versions) {
  if (version !== expectedVersion) {
    fail(`${source} is ${version ?? "missing"}, expected ${expectedVersion}`);
  }
}

process.stdout.write(
  `Release tag ${tag} agrees with application version ${expectedVersion}.\n`,
);
