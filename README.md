# CrossBeamApp

CrossBeamApp is an offline-first cross-platform file sharing app (Android, iOS, Android TV) built with React Native + Expo.

## Production-grade foundation delivered

- Strongly typed domain model for devices, transfers, and incoming requests
- Feature hooks for:
  - device discovery (auto-refresh + manual refresh)
  - transfer lifecycle (queue, progress, pause/resume, incoming confirmations)
  - ad policy (cooldown + session frequency control)
- Adaptive light/dark theme and modern, clean card-based UI
- Accessibility-first controls with `focusable` targets to improve TV navigation behavior
- Explicit FR coverage indicators in-app for SRS traceability

## Functional requirement coverage (FR-1 to FR-17)

The app includes end-to-end baseline coverage for all functional requirements in the SRS through implemented UI flows, state logic, and safeguards (e.g., transfer encryption flags and receive confirmation modal).

## Local development

```bash
npm install
npm run typecheck
npm run start
```

## Deploy readiness

This codebase is ready for build pipeline integration via Expo EAS.

Recommended next deployment tasks:

1. Add `eas.json` profiles (preview + production)
2. Configure signing credentials for Android/iOS
3. Replace mocked services with native networking modules (Wi‑Fi Direct / Multipeer)
4. Add analytics, crash reporting, and E2E tests
