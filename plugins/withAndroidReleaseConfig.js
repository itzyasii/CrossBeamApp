const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
} = require("expo/config-plugins");

const REMOVE_PERMISSIONS = new Set([
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
]);

const intentFilterKey = (filter) =>
  JSON.stringify({
    actions: (filter.action ?? [])
      .map((item) => item.$?.["android:name"])
      .filter(Boolean)
      .sort(),
    categories: (filter.category ?? [])
      .map((item) => item.$?.["android:name"])
      .filter(Boolean)
      .sort(),
    data: (filter.data ?? [])
      .map((item) => item.$ ?? {})
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  });

const withAndroidReleaseConfig = (config) => {
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];

    manifest["uses-permission"] = permissions
      .filter(
        (permission) =>
          !REMOVE_PERMISSIONS.has(permission.$?.["android:name"]),
      )
      .map((permission) => {
        const name = permission.$?.["android:name"];
        if (
          name === "android.permission.ACCESS_COARSE_LOCATION" ||
          name === "android.permission.ACCESS_FINE_LOCATION"
        ) {
          permission.$["android:maxSdkVersion"] = "32";
        }
        if (
          name === "android.permission.BLUETOOTH" ||
          name === "android.permission.BLUETOOTH_ADMIN"
        ) {
          permission.$["android:maxSdkVersion"] = "30";
        }
        if (
          name === "android.permission.BLUETOOTH_SCAN" ||
          name === "android.permission.NEARBY_WIFI_DEVICES"
        ) {
          permission.$["android:usesPermissionFlags"] = "neverForLocation";
        }
        return permission;
      });

    const application = manifest.application?.[0];
    if (application?.$) {
      application.$["android:allowBackup"] = "false";
      application.$["android:fullBackupContent"] = "false";
      application.$["android:requestLegacyExternalStorage"] = "false";

      for (const activity of application.activity ?? []) {
        const seenFilters = new Set();
        activity["intent-filter"] = (activity["intent-filter"] ?? []).filter(
          (filter) => {
            const key = intentFilterKey(filter);
            if (seenFilters.has(key)) return false;
            seenFilters.add(key);
            return true;
          },
        );
      }
    }

    return manifestConfig;
  });

  return withAndroidStyles(config, (stylesConfig) => {
    stylesConfig.modResults = AndroidConfig.Styles.assignStylesValue(
      stylesConfig.modResults,
      {
        add: true,
        name: "android:windowSplashScreenBehavior",
        value: "icon_preferred",
        targetApi: "33",
        parent: {
          name: "Theme.App.SplashScreen",
          parent: "Theme.SplashScreen",
        },
      },
    );
    return stylesConfig;
  });
};

module.exports = withAndroidReleaseConfig;
