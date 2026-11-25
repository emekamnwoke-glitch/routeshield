# ADR-0021: Adopt a token-based design language with opaque decision surfaces

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-11-25 |
| **Phase** | H — raised from the Stage Two interface redesign |
| **Principles engaged** | P-1, P-3, P-4, P-9, P-11 |
| **Requirements** | BR-019, BR-020, BR-021 · AC-13 |
| **Supersedes** | — |

---

> **Partly recorded after the code.** The design tokens ([`frontend/src/tokens.css`](../../frontend/src/tokens.css)) were merged before this ADR was written, which runs ahead of [P-11](../01-stage-one-architecture/methodology/architecture-principles.md#p-11--architecture-changes-before-implementation-does). They change no behaviour and no screen used them at the time. Everything that follows them is governed by this record. See [change log CH-013](../01-stage-one-architecture/phase-h-change-management/change-log.md).

## Context

AC-13, the Control Workspace, is a component and not merely "the UI". How it presents reasoning and uncertainty decides whether an approval is a real evaluation or just a formality ([application components](../01-stage-one-architecture/phase-c-information-systems/application-architecture/application-components.md#ac-13--control-workspace)). BR-019 requires each recommendation to be shown with its rationale, what it gives up and what was not known. BR-020 and BR-021 require an identified person to approve, reject or modify it.

Until now the workspace had no stated visual rules. CH-010 laid it out as a dashboard with dark chrome, gradients and colours chosen screen by screen. That works for one screen, but the redesign adds more: a review queue, a review drawer, a role switcher, a map with click-to-report and a command palette. Without shared rules, each of them would pick its own surfaces, colours and motion.

The redesign was worked out in Figma ([design file](https://www.figma.com/design/Be8nKkNQ4YqCsWTklyCu3m), the same source named in `tokens.css`) and reviewed before any build. It is based on Material Design 3, which is published openly. One question was argued during the review: whether to use translucent "glass" surfaces, which blur whatever lies behind them.

## Problem

What visual rules should govern the Control Workspace, and in particular, may a surface where a decision is made be translucent?

## Options considered

### Option 1 — No stated design language

Style each screen as it is built, as CH-010 did.

**For:** No up-front work. Each screen can be tuned on its own.
**Against:** Colours, surfaces and motion drift apart as screens are added. Contrast is checked by eye, if at all. Nothing stops a later screen from undermining how decisions are presented.

### Option 2 — Material Design 3 tokens, every surface opaque

Every colour, spacing step, radius, type style and motion value comes from named tokens. Surfaces are opaque and tonal: depth comes from a container's tone, not from shadows or blur.

**For:** Legibility does not depend on what lies behind a surface. Contrast can be tested mechanically. It is simple to build and to explain.
**Against:** Transient overlays over the map (a callout, a palette, a selection bar) hide the map they refer to. The map then has to be cropped or re-laid out around them.

### Option 3 — Material Design 3 tokens, with glass on three transient overlays only

The same as Option 2, except three short-lived overlays use translucent glass: the map callout, the command palette and the selection bar. Every surface where something is read in order to decide stays opaque, the review drawer above all.

**For:** The map stays visible under the overlays that point at it. Decision surfaces keep the legibility of Option 2. Glass is confined to places that last seconds and carry little text.
**Against:** Two surface models to build and explain. Glass needs a fallback for browsers without backdrop blur, and its contrast depends on the map beneath it, so it needs its own test.

### Option 4 — Glass throughout

Translucent panels everywhere, including the review drawer.

**For:** A single, distinctive look.
**Against:** Text contrast changes with whatever lies behind the panel. In the review drawer that means the rationale, the cost terms and the confidence (BR-019) become harder to read exactly when a decision is being made. It is also expensive to render on modest hardware.

## Decision

**Option 3.**

1. **Tokens are the only source of visual values.** Colours, spacing, radii, type and motion are CSS custom properties named `--rs-*`, generated from the Figma variables, never edited by hand. Components use the semantic aliases (for example `--rs-surface-tonal-container`), not raw colour roles.
2. **Surfaces are opaque and tonal.** There are no gradients and no drop shadows on content surfaces.
3. **Glass is allowed on exactly three surfaces:** the map callout, the command palette and the selection bar. It uses `--rs-surface-glass-selection-fill` with a 24 px blur. Where the browser cannot blur, or the visitor prefers reduced transparency, it falls back to the opaque `--rs-surface-glass-fallback`.
4. **The review drawer is always opaque.** So is any other surface that presents a recommendation, its rationale, cost or confidence, or that captures a decision.
5. **Motion has two speeds:** 150 ms and 240 ms, with emphasised easing. With reduced motion, every transition becomes a 150 ms cross-fade.
6. **Themes and density:** light and dark themes, and comfortable and compact density, all switched through the tokens. Light is the default; dark follows the system setting or an explicit `data-theme`.
7. **Contrast is enforced by test.** [`tests/frontend/tokens.test.ts`](../../tests/frontend/tokens.test.ts) checks:
   - text at 4.5:1
   - map lines at 3:1 against the map surface
   - text on glass at 4.5:1 over the map colours

   A token change that fails the test does not merge.

## Rationale

P-1 decided it. The human decides, and BR-019 makes the quality of that decision depend on what the controller can read. A translucent decision surface lets map colours bleed into the rationale and cost terms. That is a small but real cost, paid at the moment that matters most. So Option 4 is out, and the drawer rule in Option 3 is not negotiable.

Between Options 2 and 3 the call was close. Option 3 won because the three overlays exist to point at something on the map. Hiding the map under them works against their purpose, and none of them is a place where a decision is made. If glass proves hard to keep legible, Option 2 is the fallback, and switching to it means changing three components.

P-4 favours an openly published system (Material Design 3) and a web standard (CSS custom properties) over a bespoke one. P-3 is met by the opaque fallback for glass. P-9 is met by adopting the token set already reviewed in Figma rather than inventing one.

## Consequences

### Positive
- Every screen built from now on shares one set of values and one rule for surfaces.
- Contrast is a test, not a judgement.
- Light, dark and compact come from the tokens, not from each screen.

### Negative
- Visual values now live in two places, Figma and `tokens.css`, and the export must be re-run after any Figma change. Nothing enforces that the two agree except the generator and review.
- Glass adds a fallback path and a second contrast test that opaque surfaces do not need.
- The existing stylesheet, written before the tokens, uses fixed spacing. Compact density has no effect on it until each screen is rebuilt.

### Neutral
- The sidebar and header lose CH-010's dark chrome and become tonal surfaces in both themes.
- Whether light should remain the default theme is still open. Changing it means changing a token, not this decision.

## Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Glass spreads beyond the three named surfaces | Medium | Medium | This ADR names them. Review rejects glass anywhere else. |
| Figma and `tokens.css` drift apart | Medium | Low | Regenerate from Figma; never edit by hand. The file header says so. |
| Text on glass falls below 4.5:1 over a busy part of the map | Low | Medium | The glass contrast test; the opaque fallback |
| A third-party component brings its own colours | Low | Low | Map its colours onto the semantic aliases, or do not adopt it |

## Alternatives rejected

**Option 1** — *would become right if* the workspace shrank to a single screen with no planned growth.

**Option 2** — *would become right if* glass could not hold 4.5:1 over the map, or a target browser could not blur at acceptable cost. It is the fallback for this decision.

**Option 4** — *would become right if* the drawer stopped carrying decision content, which BR-019 rules out.

## Review trigger

Any proposal to make the review drawer, or any other decision surface, translucent. Also: a fourth surface asking for glass, a move away from Material Design 3, or a target device where backdrop blur is unavailable or too slow.
