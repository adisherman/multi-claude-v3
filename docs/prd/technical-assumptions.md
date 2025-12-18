# 9. Technical Assumptions & Constraints
- Platforms: iOS and Android via Expo (managed workflow).
- Stack versions: Expo ~54, React Native 0.81.x, React 19.1, TypeScript ~5.9 (aligned with provided template).
- Repository: Monorepo (backend/ and mobile/ in one repo). Backend is present but unused in MVP.
- Architecture: Mobile‑only monolith (no backend in MVP).
- Storage: AsyncStorage for stats/settings.
- Testing: Unit + Integration (unit tests for pure game engine; integration smoke tests for key UI flow).
- State: React hooks/local state; no global store required for MVP.