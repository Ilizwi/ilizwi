# Immediate Post-Stage Enhancements

Last updated: 2026-03-13
Status: queued for implementation immediately after the current build stage and before client presentation

This file captures near-term enhancements that are intentionally not part of the current feature stage, but are expected to be implemented next.

## Purpose

These items should:

- materially improve the product before client presentation
- avoid destabilizing the current stage while it is still being completed
- remain close enough to current work that future sessions can pick them up without rediscovery

## EP001 — Claude Translation Escalation Path

### Why this exists

The platform needs a translation workflow that is affordable at scale but still capable of handling difficult historical passages.

The current architectural decision is:

- use **Google Cloud Translation** as the default provider for bulk draft generation
- keep **Claude API** as a higher-cost, manually triggered escalation path for difficult passages
- keep **human-corrected translation** as the final scholarly authority

This creates a strong practical balance:

- Google handles corpus-scale draft generation affordably
- Claude can be used selectively when translation quality is poor or historically sensitive
- translators and researchers remain in control

### Product intent

This should feel like a high-value scholarly assist, not a black-box auto-rewrite.

The user should be able to:

1. view the existing machine translation draft
2. decide that the draft is inadequate
3. explicitly trigger a **Retry with Claude** action
4. receive a new draft generated from the best available source text layer
5. compare the original draft and Claude draft without silent replacement
6. choose whether to adopt, edit, or reject the Claude result

### Source layer policy

Eligible input layers for machine translation are:

1. `corrected_transcription`
2. `source_transcription`
3. `source_ocr`

Priority rule:

- always use the best available eligible source layer
- do not translate from a weaker layer if a stronger one exists

### Scope for this enhancement

Implement:

- a manually triggered **Retry with Claude** action on translation drafts
- provider-aware translation metadata
- storage of multiple machine-generated drafts without overwriting
- clear provenance of which provider generated which draft
- UI comparison between the existing draft and the Claude draft

Do not implement yet:

- automatic quality scoring
- automatic fallback from Google to Claude
- automatic provider switching
- automatic replacement of an existing draft

### Required metadata

Every machine translation draft should record:

- `provider`
- `model` or service identifier if available
- `translated_at`
- `source_layer_type`
- `source_layer_id`
- `source_language`
- `target_language`
- whether the draft is the default draft or an escalation draft

### UX expectations

- the trigger should be explicit and user-controlled
- Claude retry should be framed as a premium / careful retry, not the default button
- the UI should preserve scholarly confidence:
  - show which provider produced each draft
  - show when it was generated
  - never silently discard the earlier translation

### Suggested trigger conditions

The first version should be manual only.

Typical user reasons to trigger it:

- translation is obviously poor
- source passage is historically dense or idiomatic
- orthography is unstable or archaic
- the user wants a second opinion before manual editing

### Why this matters for the client

If this works well, it can materially reduce the amount of translator effort needed on difficult passages and create a strong “wow” moment in the client demo.

It should be presented as:

- a selective high-quality retry path
- not a promise of perfect autonomous translation

## Implementation note

This enhancement should be implemented after the current stage completes, but before presenting the product to Dr Panashe.
