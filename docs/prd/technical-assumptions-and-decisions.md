# 7. Technical Assumptions and Decisions

- Repository Structure: Monorepo (backend/ and mobile/ in one repository)
- Service Architecture: Mobile‑only Monolith (Expo app only; no backend services)
  - Note: backend/ retained as scaffold for potential post‑MVP features; not used at runtime
- Testing Requirements: Unit + Integration (pure game logic unit tests + key UI flow smoke tests)
- Storage: AsyncStorage for non‑sensitive local stats and settings
- State Management: React state + hooks (no global state library for MVP)
- Versions: Expo ~54, React Native 0.81.x, React 19.1, TypeScript ~5.9