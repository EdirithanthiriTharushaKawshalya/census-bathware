import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const windows = process.platform === "win32";
const env = { ...process.env };
if (!env.JAVA_HOME && windows) {
  const bundled = join(
    env.ProgramFiles || "C:/Program Files",
    "Android",
    "Android Studio",
    "jbr",
  );
  if (existsSync(join(bundled, "bin", "java.exe"))) env.JAVA_HOME = bundled;
}
if (!env.ANDROID_HOME && windows && env.LOCALAPPDATA) {
  const sdk = join(env.LOCALAPPDATA, "Android", "Sdk");
  if (existsSync(sdk)) env.ANDROID_HOME = sdk;
}
if (!env.JAVA_HOME || !env.ANDROID_HOME) {
  console.error(
    "Install Android Studio and SDK; set JAVA_HOME to its JDK 21+ and ANDROID_HOME to your Android SDK. See docs/mobile-app.md.",
  );
  process.exit(1);
}
const result = spawnSync(
  windows ? "gradlew.bat" : "./gradlew",
  ["assembleDebug", "lintDebug", "--console=plain", "--no-daemon"],
  { cwd: "android", env, stdio: "inherit", shell: windows },
);
if (result.error) console.error(result.error.message);
if (result.status === 0)
  console.log(
    "Test APK: android/app/build/outputs/apk/debug/app-debug.apk (development signing only)",
  );
process.exit(result.status ?? 1);
