const { spawnSync } = require("child_process");
const path = require("path");

const androidDirectory = path.resolve(__dirname, "..", "android");
const wrapper = path.join(
  androidDirectory,
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
const command = process.platform === "win32" ? "gradlew.bat" : wrapper;
const result = spawnSync(command, process.argv.slice(2), {
  cwd: androidDirectory,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
