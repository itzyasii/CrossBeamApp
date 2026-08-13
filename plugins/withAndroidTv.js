const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const TV_FEATURES = [
  "android.software.leanback",
  "android.hardware.touchscreen",
  "android.hardware.camera",
  "android.hardware.camera.any",
  "android.hardware.camera.autofocus",
];

const withAndroidTv = (config) => {
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const features = manifest["uses-feature"] ?? [];

    for (const name of TV_FEATURES) {
      const existing = features.find(
        (feature) => feature.$?.["android:name"] === name,
      );
      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        features.push({
          $: {
            "android:name": name,
            "android:required": "false",
          },
        });
      }
    }
    manifest["uses-feature"] = features;

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults,
    );
    application.$["android:banner"] = "@drawable/tv_banner";

    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      manifestConfig.modResults,
    );
    const mainFilter = (mainActivity["intent-filter"] ?? []).find((filter) =>
      filter.action?.some(
        (action) => action.$?.["android:name"] === "android.intent.action.MAIN",
      ),
    );
    if (mainFilter) {
      const categories = mainFilter.category ?? [];
      if (
        !categories.some(
          (category) =>
            category.$?.["android:name"] ===
            "android.intent.category.LEANBACK_LAUNCHER",
        )
      ) {
        categories.push({
          $: {
            "android:name": "android.intent.category.LEANBACK_LAUNCHER",
          },
        });
      }
      mainFilter.category = categories;
    }

    return manifestConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const source = path.join(
        modConfig.modRequest.projectRoot,
        "assets",
        "tv_banner_xhdpi.png",
      );
      const destinationDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable-xhdpi",
      );
      await fs.promises.mkdir(destinationDirectory, { recursive: true });
      await fs.promises.copyFile(
        source,
        path.join(destinationDirectory, "tv_banner.png"),
      );
      return modConfig;
    },
  ]);
};

module.exports = withAndroidTv;
