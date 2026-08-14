import { parsePairingPayload } from "@/utils/pairing";

const NOW = 1_800_000_000_000;
const validPayload = {
  scheme: "crossbeam-pair",
  version: 1,
  id: "tv-lounge",
  deviceKey: "local-device-key",
  name: "Lounge TV",
  platform: "android-tv",
  host: "192.168.1.25",
  port: 5354,
  expiresAt: NOW + 600_000,
};

describe("parsePairingPayload", () => {
  it("accepts a complete unexpired CrossBeam payload", () => {
    expect(parsePairingPayload(JSON.stringify(validPayload), NOW)).toEqual(
      validPayload,
    );
  });

  it("rejects an expired payload", () => {
    expect(() =>
      parsePairingPayload(
        JSON.stringify({ ...validPayload, expiresAt: NOW - 1 }),
        NOW,
      ),
    ).toThrow("expired");
  });

  it("rejects unsupported schemes and versions", () => {
    expect(() =>
      parsePairingPayload(
        JSON.stringify({ ...validPayload, scheme: "other-app" }),
        NOW,
      ),
    ).toThrow("not a CrossBeam pairing code");
  });

  it("rejects invalid ports and missing identity fields", () => {
    expect(() =>
      parsePairingPayload(
        JSON.stringify({ ...validPayload, id: "", port: 70_000 }),
        NOW,
      ),
    ).toThrow("malformed");
  });
});
