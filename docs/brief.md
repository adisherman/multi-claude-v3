# Project Brief: XO

## Overview
XO is a small, stylish tic‑tac‑toe game built as a greenfield project using Expo (React Native) and TypeScript. The aim is to deliver a polished, quick-play experience that feels satisfying on modern iOS and Android devices while keeping scope tight for rapid MVP delivery.

## Goals
- Deliver a fun, fast tic‑tac‑toe game with delightful polish.
- Ship on iOS and Android using a single Expo codebase.
- Keep the MVP offline-first with no backend dependency.
- Establish clean, testable game logic for future expansion (themes, modes).

## Non‑Goals (MVP)
- Online multiplayer or leaderboards.
- Accounts, authentication, or cloud profiles.
- Ads, IAP, analytics, or telemetry.
- Complex game variants beyond classic 3×3.

## Target Users and Platforms
- Casual mobile players looking for a quick match or short sessions.
- Platforms: iOS and Android (Expo-managed workflow).

## MVP Feature Scope
- Classic 3×3 board gameplay with X/O turns.
- Two modes:
  - Local Pass‑and‑Play (two players, same device).
  - Solo vs CPU with basic AI (win/block + simple heuristics).
- Onboarding tip and one-tap New Game / Restart.
- Turn indicator and win/draw detection with celebratory feedback (haptics/sound/animation).
- Minimal settings: toggle sound/haptics, reset stats.
- Local stats: wins/losses/draws per mode, stored on device.
- No network calls; works fully offline.

## Success Metrics (MVP)
- Time-to-first-match under 10 seconds from cold start.
- Session length: median ≥ 2 matches per session.
- Crash-free sessions ≥ 99.5% across devices.
- App bundle size: keep lean (Expo-managed defaults; avoid heavy libs).

## Experience & Style Notes
- Clean, modern visuals with subtle animations (tile reveal, win-line highlight).
- Responsive touch targets and accessible contrast.
- Optional light haptics on moves and win/draw.

## Technical Assumptions
- Tech stack: Expo ~54, React Native 0.81.x, React 19.1, TypeScript ~5.9.
- State management: lightweight (React state + hooks). No global state library required for MVP.
- Storage: device-only using Expo SecureStore or MMKV/AsyncStorage (final choice in PRD/Architecture).
- Testing: unit tests for pure game logic; basic UI smoke tests.
- Backend: none for MVP. Keep /backend folder for potential future features.

## Architecture and Code Organization (High Level)
- Mobile app structure under mobile/src with clear layers:
  - game logic (pure, framework-agnostic),
  - UI components (Board, Cell, HUD),
  - screens (Home, Game),
  - utilities (AI, storage, sound/haptics),
  - types.
- Game rules engine isolated for easy testing and future reuse.

## Risks & Mitigations
- Scope creep (animations/features): keep a strict must/should/could list; defer extras.
- Device variability: test on a small matrix (iOS + Android, phone sizes) early.
- AI feel: tune difficulty; provide basic and possibly “smart” setting post‑MVP if needed.

## Release Plan (MVP)
- Internal build → device testing on iOS and Android.
- Public TestFlight / Play Internal Track (optional) → 1.0 release.

## Open Questions
- Visual theme direction (flat/minimal vs playful/retro).
- Exact storage choice (AsyncStorage vs MMKV vs SecureStore trade‑offs).
- Sound set scope (clicks + win jingle) and haptic patterns.
- Portrait‑only vs support landscape.

## Assumptions
- A1: Offline-only MVP; no backend services.
- A2: iOS and Android targets using Expo-managed workflow.
- A3: Minimal settings and local stats only.
- A4: Basic AI is sufficient for MVP; advanced AI is a stretch.

---
This brief establishes the product vision and MVP constraints for subsequent PRD and Architecture work.