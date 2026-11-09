# Checklist for every round of progress

Run through this before handing a round over.

## 1. Code
- [ ] Each code file touched: its note (`name.md`) is still true; a rule changed or a bug fixed is in its
      "Rules and pitfalls".
- [ ] Nothing written twice: a third copy of the same few lines becomes a helper.
- [ ] Anything that can fail for a user shows a plain-language message (no raw errors).
- [ ] No script content, assets or secrets added to the repo.

## 2. Tests
- [ ] The new behaviour has a test, and the full suite passes. Never hand over a red test; if a test had to
      change, say why.

## 3. Looks (UI rounds)
- [ ] The look was agreed from a mock-up before building.
- [ ] Screenshots of every changed screen, plus odd states (empty, long text, error, conflict).
- [ ] Checked at a laptop size and a large monitor; nothing clipped; still minimal (guardrails in ROADMAP.md).

## 4. Docs and hand-over
- [ ] ROADMAP.md: step ticked `[x]` with what was actually built and what the user picked.
- [ ] README.md: any feature a user sees, in plain words.
- [ ] `.claude/CLAUDE.md`: Next, rules and Known gaps current.
- [ ] Summary to the user: what changed, what was verified and how, what was NOT verified (and why), the next step.

## 5. On the user's machine (ask them; Claude cannot check these)
- [ ] A real OneDrive synced folder, two people editing, the app in Edge on Windows.
