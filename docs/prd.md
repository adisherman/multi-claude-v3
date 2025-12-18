# XO – Product Requirements Document (PRD)

## 1. Product Summary
XO is a short, stylish tic‑tac‑toe (3×3) game built with Expo (React Native) and TypeScript for iOS and Android. MVP is offline-only, focused on a fast, polished experience with light haptics/sound and simple local stats.

## 2. Goals and Non‑Goals
- Goals
  - Deliver a fun, fast core game loop with tactile polish
  - Ship a single Expo app for iOS and Android
  - Keep architecture simple and maintainable for future enhancements
- Non‑Goals (MVP)
  - Online play, accounts, cloud leaderboards
  - Ads/IAP/analytics/telemetry
  - Boards beyond classic 3×3

## 3. Users and Platforms
- Users: Casual mobile players seeking quick, satisfying matches
- Platforms: iOS and Android (Expo‑managed workflow)

## 4. MVP Functional Scope
- Core Gameplay
  - 3×3 board, X/O alternating turns, valid move enforcement
  - Win/draw detection; highlight win line
  - New Game / Restart
- Modes
  - Solo vs CPU (basic heuristic AI: win/block + simple priority)
  - Local pass‑and‑play (two players on one device)
- UX Features
  - Turn indicator, subtle animations, celebratory feedback on win/draw
  - Settings: toggle sound/haptics; reset local stats
- Local Data
  - Store wins/losses/draws per mode and settings on device (no network)

## 5. Non‑Functional Requirements
- Performance: Time‑to‑first‑match under 10s cold start; smooth animations
- Reliability: Crash‑free sessions ≥ 99.5%
- Accessibility: WCAG AA target for color contrast and touch targets
- Orientation: Portrait only
- Bundle size: keep lean; avoid unnecessary heavy dependencies

## 6. UI/UX Goals (High Level)
- Overall UX Vision: Clean, modern, minimal friction to start a match; subtle polish
- Key Interaction Paradigms: Tap to place mark; quick restart; unobtrusive settings
- Core Screens and Views
  - Home (Play vs CPU, Pass‑and‑Play, Quick Start)
  - Game (board, HUD with turn indicator, win/draw banner, restart)
  - Settings (sound, haptics, reset stats)
- Accessibility Target: WCAG AA
- Branding: TBD (theme/style direction pending)
- Target Devices/Platforms: Mobile only (iOS & Android)

## 7. Technical Assumptions and Decisions
- Repository Structure: Monorepo (backend/ and mobile/ in one repository)
- Service Architecture: Mobile‑only Monolith (Expo app only; no backend services)
  - Note: backend/ retained as scaffold for potential post‑MVP features; not used at runtime
- Testing Requirements: Unit + Integration (pure game logic unit tests + key UI flow smoke tests)
- Storage: AsyncStorage for non‑sensitive local stats and settings
- State Management: React state + hooks (no global state library for MVP)
- Versions: Expo ~54, React Native 0.81.x, React 19.1, TypeScript ~5.9

## 8. Epics (MVP)
1) Epic: Core Game Loop and Rules Engine
   - Goal: Implement pure, framework‑agnostic game logic (board state, rules, win/draw), UI board rendering, turn indicator, restart
   - High‑Level Acceptance: Make a legal move; detect win/draw; restart clears state; logic covered by unit tests

2) Epic: Solo vs CPU and Local Multiplayer
   - Goal: Add pass‑and‑play mode and basic CPU opponent with simple heuristics
   - High‑Level Acceptance: Mode selection works; CPU makes valid timely moves; human‑vs‑human alternation; outcomes tracked

3) Epic: UX Polish, Settings, and Local Stats
   - Goal: Add animations, haptics/sound toggles, reset stats, AsyncStorage persistence for stats/settings
   - High‑Level Acceptance: Win line highlight; settings persist across sessions; stats update accurately and can be reset

## 9. Risks & Mitigations
- Scope creep on polish: enforce must/should/could; defer extras post‑MVP
- AI feel too simple: tune heuristics; consider a "smarter" level post‑MVP
- Device variability: test on small matrix (iOS/Android, varied screen sizes) early

## 10. Success Metrics
- Time‑to‑first‑match < 10s; median ≥ 2 matches/session; ≥ 99.5% crash‑free sessions

## 11. Open Questions
- Visual theme direction (minimal, playful, neon/arcade, or custom)
- Exact sound set and haptic patterns
- Any localization needs (likely out‑of‑scope for MVP)
