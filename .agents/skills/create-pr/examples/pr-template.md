# Pull Request Template Reference

Use this reference layout when constructing PR descriptions on GitHub.

---

## Example 1: Code Pull Request (`feat/` or `fix/`)

```markdown
## Summary
- Implement dedicated Mute Dial action for Stream Deck +
- Add mute state tracking and toggle logic in State Manager

## Motivation & Architecture
- Resolves issue #42 by enabling direct mute toggling via dial push while preserving volume rotation.
- Conforms to Stream Deck SDK 3 dial hierarchy and 10-Hz hardware throttle limit.

## Quality Verification
- [x] npm run lint (0 errors, 0 warnings)
- [x] npm run build (clean Rollup bundle)
- [x] npm run validate (official Elgato CLI)
```

---

## Example 2: Documentation-Only Pull Request (`docs/`)

```markdown
## Summary
- Update LCD touchstrip layout documentation in `docs/architecture.md`
- Clarify active pause indicator rendering rules in `docs/features.md`

## Motivation & Architecture
- Keeps technical documentation synchronized with recent image-renderer changes per AGENTS.md.

## Quality Verification
- [x] Documentation-only change (code quality gates skipped per AGENTS.md)
```
