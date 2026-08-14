const { spawnSync } = require("child_process");
const path = require("path");

const androidDirectory = path.resolve(__dirname, "..", "android");
const wrapper = path.join(
  androidDirectory,
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
const isWindows = process.platform === "win32";
const command = isWindows ? "gradlew.bat" : "bash";
const args = isWindows
  ? process.argv.slice(2)
  : [wrapper, ...process.argv.slice(2)];
const result = spawnSync(command, args, {
  cwd: androidDirectory,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
  shell: isWindows,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
