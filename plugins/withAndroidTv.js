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
      mainFilter.category = (mainFilter.category ?? []).filter(
        (category) =>
          category.$?.["android:name"] !==
          "android.intent.category.LEANBACK_LAUNCHER",
      );
    }

    const aliases = application["activity-alias"] ?? [];
    const tvAliasName = ".TvLauncherActivity";
    const existingAlias = aliases.find(
      (alias) => alias.$?.["android:name"] === tvAliasName,
    );
    const tvAlias = existingAlias ?? { $: {} };
    tvAlias.$ = {
      ...tvAlias.$,
      "android:name": tvAliasName,
      "android:targetActivity": ".MainActivity",
      "android:exported": "true",
      "android:icon": "@drawable/tv_icon",
      "android:banner": "@drawable/tv_banner",
    };
    tvAlias["intent-filter"] = [
      {
        action: [
          { $: { "android:name": "android.intent.action.MAIN" } },
        ],
        category: [
          {
            $: {
              "android:name":
                "android.intent.category.LEANBACK_LAUNCHER",
            },
          },
        ],
      },
    ];
    if (!existingAlias) aliases.push(tvAlias);
    application["activity-alias"] = aliases;

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
      await fs.promises.copyFile(
        path.join(
          modConfig.modRequest.projectRoot,
          "assets",
          "tv_icon_xhdpi.png",
        ),
        path.join(destinationDirectory, "tv_icon.png"),
      );
      return modConfig;
    },
  ]);
};

module.exports = withAndroidTv;
