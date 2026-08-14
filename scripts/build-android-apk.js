const { spawnSync } = require("child_process");
const path = require("path");

const buildAllArchitectures = process.argv.includes("--all");
const architecture = "arm64-v8a";
const runGradle = path.resolve(__dirname, "run-gradle.js");
const environment = {
  ...process.env,
  NODE_ENV: "development",
};

if (!buildAllArchitectures) {
  environment.ORG_GRADLE_PROJECT_reactNativeArchitectures = architecture;
}

console.log(
  buildAllArchitectures
    ? "Building a debug APK for every configured Android architecture..."
    : `Building a debug APK for ${architecture}...`,
);

const result = spawnSync(
  process.execPath,
  [runGradle, ":app:assembleDebug"],
  {
    cwd: path.resolve(__dirname, ".."),
    env: environment,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(
  "APK created at android/app/build/outputs/apk/debug/app-debug.apk",
);
