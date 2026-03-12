# ILIZWI Design System

Last updated: 2026-03-12
Status: Current working design direction

## Brand Identity

Working brand: **ILIZWI**

Core concept:

- The Digital Scriptorium
- a high-contrast meeting point between 19th-century intellectualism and modern clarity
- the interface should feel like an instrument, not a generic tool

Tone:

- scholarly
- weighty
- calm
- intentional

## Mode Strategy

This system uses a two-environment visual model:

### 1. The Vault

Dark mode / primary identity mode.

Use for:

- landing states
- navigation shell
- sidebars
- admin chrome where appropriate

### 2. The Desk

Light workspace mode for deep reading and active research.

Use for:

- main workspace background
- document reading areas
- metadata and text comparison panes

## Color System

### The Vault

- `Ink-Black`: `#0C0C0D`
- `Carbon-Surface`: `#161618`
- `Bone-White`: `#E8E2D9`
- `Graphite-Muted`: `#8B8680`

### The Desk

- `Slate-Paper`: `#F7F9FA`
- `The Sheet`: `#FFFFFF`
- `The Typewriter`: `#1A1A24`
- `Linen-Border`: `rgba(15, 23, 42, 0.08)`

### Semantic / Accent

- `Historic Green`: `#4A5D4E`
- `The Underline`: `rgba(74, 93, 78, 0.12)`

## Typography

### Serif voice

Preferred family:

- `Playfair Display`

Allowed substitutes:

- `Newsreader`
- `Tiempos Fine`

Use for:

- H1-H3
- original archival text moments
- quotations

Rule:

- use `letter-spacing: -0.02em` for major serif titles

### Sans tool

Preferred family:

- `Inter`

Allowed substitutes:

- `Geist`
- `SF Pro`

Use for:

- navigation
- buttons
- inputs
- metadata
- transcription
- translation
- admin UI

Rule:

- use lighter weights by default
- use stronger weights only for clear action emphasis

## Shape and Geometry

- buttons and controls should not feel bubbly
- standard radii should remain tight

Recommended:

- UI controls: `2px` or `4px`
- reading sheet / document surfaces: `8px`

## Elevation

Avoid heavy card-shadow aesthetics.

Preferred depth style:

- soft ambient depth
- large, low-opacity shadows
- subtle glass treatment for dark sidebars where useful

Recommended desk shadow:

- `0 40px 80px rgba(0, 0, 0, 0.03)`

## Motion

Motion should feel weighted, not fast or playful.

Guidelines:

- soft reveal transitions
- slower hover transitions
- highlight motion should feel like a pen stroke, not a flash

Recommended timing:

- page reveal: `1200ms`
- hover: `300ms ease-out`
- underline growth: `400ms`

## Layout Rules

### Rule 1: Dark Sidebar Anchor

Even when the main workspace is light, the left sidebar should remain dark.

Purpose:

- maintain continuity from landing to workspace
- reduce the “flashbang” effect
- preserve the visual identity anchor

### Rule 2: Centered Reading Surface

Primary reading content should be centered with generous side space.

Purpose:

- reduce distraction
- support concentration
- make the document pane feel like a deliberate reading sheet

### Rule 3: Metadata Hierarchy

Metadata should be visually smaller and quieter than content.

Recommended metadata style:

- all caps where appropriate
- around `0.7rem`
- wider letter spacing
- muted tone

## Product-Specific UI Implications

The design system must support:

- source-file viewing
- transcription and translation comparison
- provenance visibility
- annotation overlays or note panels
- uncertainty/dispute indicators
- research-density interfaces without visual chaos

## Hard Rules

1. Never use pure `#000000` or pure `#FFFFFF` for the overall brand system, except the reading sheet itself.
2. Never let the workspace become generic “dashboard blue SaaS.”
3. Never hide provenance or review state visually.
4. Never use exaggerated rounded corners or playful UI language.
5. Do not introduce random accent colors beyond the locked system.

## References for Agents

All feature agents must also read:

- `docs/design/Ilizwi_Brand_Direction.md`
- `docs/design/ILIZWI_AGENT_GUIDE.md`
- `docs/design/design-tokens.json`
