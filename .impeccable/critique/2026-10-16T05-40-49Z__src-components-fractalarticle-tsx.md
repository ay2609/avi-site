---
target: fractals stage /fractals
total_score: 23
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:/Users/ay2609/workspaces/avi-site/src/components/FractalArticle.tsx"
target_fingerprint: "sha256:bed4c71e4beb33df2a21052a85ce6caa2bf3901cbeab899bc5c984f46d54375f"
target_path: /Users/ay2609/workspaces/avi-site/src/components/FractalArticle.tsx
timestamp: 2026-10-16T05-40-49Z
slug: src-components-fractalarticle-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Fractals stage `/fractals`

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The index marker and the ▸ on the active preset are clear |
| 2 | Match system / real world | 2 | "FRAOTIC", "PRISONAH", "TSUCS" and "b .1998" are unexplained |
| 3 | User control and freedom | 3 | Esc, back and the index work |
| 4 | Consistency and standards | 2 | The preset list's position changes with width, and it disappears on phone |
| 5 | Error prevention | 3 | One chapter per gesture |
| 6 | Recognition rather than recall | 2 | Phone: "tap for the next preset" is never shown |
| 7 | Flexibility and efficiency | 3 | Keys, index and presets |
| 8 | Aesthetic and minimalist design | 2 | Fraotic shows about 19 options at once |
| 9 | Error recovery | 3 | Nothing to fail |
| 10 | Help and documentation | n/a | Portfolio |
| **Total** | | **23/36** | **Acceptable** |

### Priority issues
- **[P1] The owner's vocabulary is unexplained.** FRAOTIC reads as a typo. Fix: a one-line gloss per chapter, in the owner's words. (/impeccable clarify)
- **[P2] A wall of options in Julia (12 rows) and Fraotic (about 19 chips).** (/impeccable distill)
- **[P2] Phone presets are invisible.** The only way to change preset is an unannounced tap. Fix: a touch hint. (/impeccable adapt)
- **[P3] Chapter 00 has no preset furniture while 01 and 02 do.** (/impeccable polish)

Detector: 5 findings. The 10px chapter nav is real; the others are false positives.
