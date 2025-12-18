# 8. Testing Strategy
- Scope per PRD: Unit + Integration tests for core logic and key UI flows.
- Unit tests (Jest): engine functions for all win/draw paths; AI move selection sanity.
- Integration tests (Testing Library RN): happy path for Solo and Pass‑and‑Play; restart flow; settings toggles; stats updates.
- Manual smoke on a small matrix (iOS/Android phones) before release.