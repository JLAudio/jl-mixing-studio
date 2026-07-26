import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

function fail(message) {
  process.stderr.write(`Release asset staging failed: ${message}\n`);
  process.exit(1);
}

const [tag, bundleDirectory, extension, platform, architecture] =
  process.argv.slice(2);

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? "")) {
  fail(`invalid release tag "${tag ?? ""}"`);
}

const sourceDirectory = join(
  "src-tauri",
  "target",
  "release",
  "bundle",
  bundleDirectory,
);
const installers = readdirSync(sourceDirectory)
  .map((name) => join(sourceDirectory, name))
  .filter(
    (path) =>
      statSync(path).isFile() &&
      path.toLowerCase().endsWith(`.${extension.toLowerCase()}`),
  );

if (installers.length !== 1) {
  fail(
    `expected exactly one .${extension} installer in ${sourceDirectory}, found ${installers.length}`,
  );
}

const version = tag.slice(1);
const outputName = `JL-Mixing-Studio_${version}_${platform}_${architecture}.${extension}`;
const outputDirectory = "release-assets";
mkdirSync(outputDirectory, { recursive: true });
copyFileSync(installers[0], join(outputDirectory, outputName));
process.stdout.write(
  `Staged ${basename(installers[0])} as ${outputName}.\n`,
);
