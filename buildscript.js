const { execSync } = require("child_process");

/*
 * Run shell commands for build
 */

// Remove existing dist directory
execSync("shx rm -rf dist");

// Copy all files to dist/ from src/
execSync("shx cp -R src/ dist/");

// Remove unnecessary tailwind.css
execSync("shx rm -rf dist/tailwind.css");

// Transpile .js files using Babel
execSync("npx babel src --out-dir dist");

// Bundling css file
execSync("npx tailwindcss build -i src/tailwind.css -o dist/popups/style.css");
