const fs = require("fs");

const versionInfo = JSON.parse(fs.readFileSync("version.json", "utf8"));
const version = versionInfo.version;

// Update manifest.json version.
const manifest = JSON.parse(fs.readFileSync("src/manifest.json", "utf8"));
manifest.version = version;
fs.writeFileSync("src/manifest.json", JSON.stringify(manifest, null, 2));

// Update package.json version.
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.version = version;
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

// Update package-lock.json version.
const packageLockJson = JSON.parse(
  fs.readFileSync("package-lock.json", "utf8")
);
packageLockJson.version = version;
packageLockJson.packages[""].version = version;
fs.writeFileSync("package-lock.json", JSON.stringify(packageLockJson, null, 2));
