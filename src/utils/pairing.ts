import type { NativePairingPayload, NativePeerPlatform } from "crossbeam-native";

const PAIRING_PLATFORMS = new Set<NativePeerPlatform>([
  "android",
  "android-tv",
  "ios",
]);

export const parsePairingPayload = (
  value: string,
  now = Date.now(),
): NativePairingPayload => {
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error("This pairing code is not valid JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("This is not a CrossBeam pairing code.");
  }

  const candidate = payload as Record<string, unknown>;
  if (candidate.scheme !== "crossbeam-pair" || candidate.version !== 1) {
    throw new Error("This is not a CrossBeam pairing code.");
  }
  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    candidate.id.length > 128 ||
    typeof candidate.deviceKey !== "string" ||
    !candidate.deviceKey.trim() ||
    candidate.deviceKey.length > 1024 ||
    typeof candidate.name !== "string" ||
    !candidate.name.trim() ||
    candidate.name.length > 120 ||
    typeof candidate.platform !== "string" ||
    !PAIRING_PLATFORMS.has(candidate.platform as NativePeerPlatform) ||
    typeof candidate.host !== "string" ||
    !candidate.host.trim() ||
    candidate.host.length > 255 ||
    typeof candidate.port !== "number" ||
    !Number.isInteger(candidate.port) ||
    candidate.port < 1 ||
    candidate.port > 65_535 ||
    typeof candidate.expiresAt !== "number" ||
    !Number.isFinite(candidate.expiresAt)
  ) {
    throw new Error("This pairing code is incomplete or malformed.");
  }
  if (candidate.expiresAt <= now) {
    throw new Error("This pairing code has expired.");
  }

  return candidate as NativePairingPayload;
};
