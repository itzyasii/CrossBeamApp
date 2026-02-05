# CrossBeamApp

Initial React Native (Expo + TypeScript) implementation scaffold based on `SRS.md`.

## Current implementation focus

- Device discovery UI and refresh flow (mock service)
- File transfer model with progress + pause/resume simulation
- History view for transfer jobs
- Minimal ad placeholder hidden during active transfer
- SRS alignment notes in-app

## Run

```bash
npm install
npm run start
```

## Notes

This is a foundation build and uses mocked networking/transfer services. Native platform-specific transfer stacks (Wi‑Fi Direct, Multipeer Connectivity, and Android TV optimizations) will be integrated in subsequent milestones.
