# CrossBeam Development Resources

## Brand Identity
- **Name:** CrossBeam
- **Core Pillars:** Private, Local-only, Ad-free, High-speed, Premium Utility.
- **Visual Style:** "Crystal Glassmorphism" — Deep navy backgrounds, semi-transparent overlays, violet/indigo accents.

## Technical Specifications
- **Framework:** React Native / Expo
- **Connectivity Protocols:** 
  - Android: Wi-Fi Direct, NSD (Network Service Discovery).
  - iOS: Multipeer Connectivity Framework.
  - Cross-platform: Local Area Network (LAN).
- **Security:** End-to-End Encryption (E2EE) for P2P tunnels, checksum verification for file integrity.

## Design Tokens (CrossBeam DS)
- **Primary Color:** `#6366f1` (Indigo/Violet)
- **Success Color:** Teal/Green (for completed transfers)
- **Error Color:** Soft Red (for failed/blocked states)
- **Surface:** `#0b1326` (Deep Navy)
- **Typography:** Hanken Grotesk (Modern, technical sans-serif)

## Required Assets for Implementation
- **Icons:** Use symbolic, thin-stroke icons (Material Symbols or Lucide).
  - Home: `home` / `dashboard`
  - Discover: `radar` / `sensors`
  - Transfer: `swap_horiz` / `send`
  - History: `history` / `folder_open`
  - Analytics: `bar_chart` / `query_stats`
  - Devices: `devices` / `trusted_client`
  - Settings: `settings`
- **Motifs:** Subtle circular radar pulses and beam-like linear gradients.

## Screen Checklist & Status
- [x] Home Dashboard (Android, iOS, TV)
- [x] Discover Devices (Android)
- [x] Active Transfer (Android)
- [x] Transfer History (Android)
- [x] Sharing Analytics (Android)
- [x] Incoming Transfer Request (TV)
- [ ] Trusted Devices List (Pending)
- [ ] Settings & Security Controls (Pending)
- [ ] iOS specific Discover/Transfer flows (Pending)
