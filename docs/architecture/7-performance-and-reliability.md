# 7. Performance & Reliability

- 60fps target; avoid unnecessary re-renders via memoization and stable props.
- CPU move selection under ~200ms typical.
- Defensive guards: never overwrite occupied cells; graceful handling of storage failures (retry/backoff minimal, defaults if read fails).