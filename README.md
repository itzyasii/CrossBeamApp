# CrossBeamApp

CrossBeamApp is an offline-first cross-platform file sharing app (Android, iOS, Android TV) built with React Native + Expo.

## What's improved

- Brand-aligned UI with a custom CrossBeam logo inspired by your design direction
- Real network test lab to validate LAN behavior on actual devices
  - Endpoint probe (GET)
  - Packet send test (POST)
  - Real download throughput check (GET binary)
- Transfer dashboard with encrypted jobs, progress, pause/resume, and incoming-request confirmation
- Device discovery refresh flow and transfer history

## Real environment testing workflow

1. Connect 2 devices on the same Wi-Fi / hotspot / LAN.
2. Run a simple HTTP receiver endpoint on one device or local machine.
3. In CrossBeam `transfer` tab:
   - set receiver endpoint URL
   - run **Probe endpoint**
   - run **Send test packet**
   - set downloadable file URL and run **Run download test**
4. Validate latency, response status, and throughput from the in-app result panel.

> Note: Native direct device-to-device transport stacks (Wi-Fi Direct, Multipeer Connectivity) require platform-specific modules and are a next milestone.

## Local development

```bash
npm install
npm run typecheck
npm run start
```
