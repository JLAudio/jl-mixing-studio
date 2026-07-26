import { readFile } from "node:fs/promises";

const pngPath = new URL("../assets/jl-studio-icon-source.png", import.meta.url);
const icnsPath = new URL("../src-tauri/icons/icon.icns", import.meta.url);

const png = await readFile(pngPath);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngEnd = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

if (!png.subarray(0, pngSignature.length).equals(pngSignature)) {
  throw new Error("JL Studio icon source does not have a valid PNG signature");
}

if (!png.subarray(-pngEnd.length).equals(pngEnd)) {
  throw new Error("JL Studio icon source is truncated or missing its PNG end marker");
}

const icns = await readFile(icnsPath);
if (icns.length < 8 || icns.toString("ascii", 0, 4) !== "icns") {
  throw new Error("macOS application icon does not have a valid ICNS header");
}

const declaredLength = icns.readUInt32BE(4);
if (declaredLength !== icns.length) {
  throw new Error(
    `macOS application icon is truncated: header declares ${declaredLength} bytes, file contains ${icns.length}`,
  );
}

console.log("Icon assets are structurally complete.");
