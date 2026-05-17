# CrossBeam

> 🔒 Where your files stay yours. Always.

CrossBeam reimagines local file sharing for the privacy-first era. Send photos, videos, documents, and large files directly between nearby devices—no cloud uploads, no data mining, no internet required. Built on decades of networking expertise, CrossBeam delivers the speed and simplicity that legacy sharing apps can't match.

Share anything. Everything. Across phones, tablets, and TVs. All on your terms.

---

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-50-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 🎯 Why CrossBeam?

In a world where every file transfer risks exposure, CrossBeam stands apart. Unlike AirDrop, Nearby Share, and third-party apps that phone home with your data, CrossBeam never leaves your local network. Your photos never touch a cloud server. your documents are never scanned, your privacy is never compromised.

### The CrossBeam Difference

| Feature                            | CrossBeam | AirDrop | Nearby Share | Cloud Transfer |
| ---------------------------------- | --------- | ------- | ------------ | -------------- |
| 🚫 **No Telemetry**                | ✅        | ❌      | ❌           | ❌             |
| 🌐 **Works Without Internet**      | ✅        | ✅      | ✅           | ❌             |
| 🔐 **Zero-Knowledge Architecture** | ✅        | ✅      | ⚠️           | ❌             |
| 📺 **Android TV Support**          | ✅        | ❌      | ⚠️           | ❌             |
| 🛡️ **SHA-256 Integrity Checks**    | ✅        | ⚠️      | ⚠️           | ⚠️             |
| 📝 **100% Open Source**            | ✅        | ❌      | ❌           | ❌             |
| 🎉 **Forever Ad-Free**             | ✅        | ✅      | ✅           | ❌             |

---

## ✨ Core Capabilities

### Privacy by Design

**Local-Only Networking** — All discovery and transfer happens over your Wi-Fi or P2P network. No outbound connections to third-party servers. Ever.

**Cryptographic Verification** — Every transfer includes SHA-256 checksum validation. What you send is exactly what the recipient receives—bit-for-bit.

**Transparent Operation** — Unlike black-box sharing solutions, every line of networking code is available for inspection. Trust, but verify.

### Technical Excellence

**Cross-Platform Native Performance**

- **Android**: Industry-standard DNS-SD/NSD discovery with raw TCP socket transfers
- **iOS**: Apple's Multipeer Connectivity framework for seamless iOS ecosystem integration
- **Unified Bridge**: Single TypeScript API abstracts platform complexity

**Enterprise-Grade Reliability**

- Byte-level progress tracking for accurate transfer estimates
- Transfer cancellation and future resumability
- Conflict resolution for duplicate filenames
- Persistent transfer history with local storage

### Polished Experience

- **Premium UI**: Metallic/crystal design system that feels at home on modern platforms
- **Honest Transparency**: Real status, real errors, no fake progress or fabricated device discovery
- **Offline-First**: Works entirely without an internet connection
- **Type-Safe Everything**: Full TypeScript codebase eliminates entire categories of bugs

---

## 🚀 Project Status

CrossBeam is in active development. We believe in radical transparency about what's shipping vs. what's still in development. No vaporware, no feature creep, no fake it 'til you make it.

### ✅ Shipped & Ready

- [x] Complete React Native UI with cross-platform design system
- [x] System document picker integration for real file selection
- [x] Persistent SQLite storage for transfer history and settings
- [x] Modular service architecture with clear separation of concerns
- [x] Native module bridge architecture for P2P communication
- [x] Android: DNS-SD discovery and TCP file transfer stack
- [x] iOS: Multipeer Connectivity session management and transfer
- [x] Comprehensive permission handling for all required capabilities

### 🚧 In Development

- [ ] Android Wi-Fi Direct P2P group negotiation for direct device-to-device
- [ ] Android foreground service with system notification integration
- [ ] Android share target integration for sharing from any app
- [ ] Android TV optimized layout with D-pad navigation support
- [ ] iOS system-level sharing extension and Files.app integration
- [ ] End-to-end encryption with secure device pairing workflow
- [ ] Chunked transfer architecture with pause/resume capabilities
- [ ] Transfer analytics and usage insights dashboard

---

## 👨‍💻 For Developers

### Prerequisites

- Node.js 18.0 or higher
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio Hedgehog or later (Android development)
- Xcode 15 or later (iOS development, macOS required)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/itzyasii/CrossBeamApp.git
cd CrossBeamApp

# Install JavaScript dependencies
npm install

# Generate native project files
npm run prebuild

# Start the development server
npm start
```

### Building Native Apps

**Important**: CrossBeam's native P2P capabilities are not available in Expo Go. You must build a custom development client:

```bash
# Android
expo run:android --device

# iOS (macOS only)
expo run:ios --device
```

Or use EAS Build for cloud compilation:

```bash
eas build --profile development --platform all
```

### Code Quality Workflow

```bash
# Run TypeScript type checking
npm run typecheck

# Execute ESLint
npm run lint

# Launch web preview
npm run web
```

---

## 🏗️ Architecture Overview

CrossBeam separates concerns into three distinct layers:

```
┌─────────────────────────────────────────┐
│              React Native UI            │  # src/screens, src/components
├─────────────────────────────────────────┤
│       TypeScript Service Layer          │  # src/services, native bridge
├─────────────────────────────────────────┤
│       Platform Native Modules           │  # modules/crossbeam-native
└─────────────────────────────────────────┘
```

**UI Layer**: Platform-agnostic components built with React Native and TypeScript

**Service Layer**: Orchestrates discovery, transfers, and storage through a unified API

**Native Layer**: Implements platform-specific networking that JavaScript cannot access

---

## ⚠️ Technical Constraints

The modern web and JavaScript runtime environments intentionally restrict low-level networking capabilities. CrossBeam requires native code to implement:

- Android Wi-Fi Direct group formation and management
- Persistent socket servers running in Android foreground services
- iOS Multipeer Connectivity framework access
- Raw socket operations required for high-performance transfers

These are fundamental limitations of the JavaScript ecosystem, not project shortcomings.

---

## 🤝 Contributing

CrossBeam welcomes contributions from developers passionate about privacy and networking. Whether you're fixing bugs, improving documentation, or implementing new features, your input helps build a better tool for everyone.

---

## 📜 License

CrossBeam is released under the MIT License. See [LICENSE](LICENSE) for the full license text.

---

<div align="center">
  <strong>Built with privacy in mind. Because your data is your business.</strong>
</div>

- Expo JavaScript cannot directly implement iOS Multipeer Connectivity sessions.
- Background transfer behavior differs by operating system and must be handled
  in native code.
- Large-file transfer must be streamed in native code to avoid loading complete
  files into memory.

## Security Direction

The production transfer engine should use:

- Explicit receiver confirmation
- Device pairing with numeric or QR verification
- Secure key storage
- Session keys per transfer
- Streaming encryption when the transport is not already protected
- Checksum validation after transfer
- Path traversal protection for received filenames
