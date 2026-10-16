---
target: watch stage /watch
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ay2609/workspaces/avi-site/src/components/WatchArticle.tsx"
target_fingerprint: "sha256:90bc649e3df3f562ce85256dcb52a90ae50e20668e75d713bbb05de548a8b2d0"
target_path: /Users/ay2609/workspaces/avi-site/src/components/WatchArticle.tsx
timestamp: 2026-10-16T05-40-49Z
slug: src-components-watcharticle-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Watch stage `/watch`

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The index marker is clear; there's no end state at the last chapter |
| 2 | Match system / real world | 2 | Callouts are designators and part numbers; on phone they disappear |
| 3 | User control and freedom | 3 | Esc, back and clickable chapters work |
| 4 | Consistency and standards | 3 | The docked globe adds a second, conflicting "Scroll to bend" |
| 5 | Error prevention | 3 | One chapter per gesture |
| 6 | Recognition rather than recall | 2 | Phone: no hint band. FACE: pressable callouts look static |
| 7 | Flexibility and efficiency | 3 | Arrows, PageUp/PageDown and the index work |
| 8 | Aesthetic and minimalist design | 3 | The docked globe competes with the board |
| 9 | Error recovery | 3 | Nothing to fail |
| 10 | Help and documentation | n/a | Portfolio |
| **Total** | | **25/36** | **Acceptable** |

### Priority issues
- **[P1] Phones lose the teardown's information.** Below a 560px box the callouts are dropped and nothing replaces them. Fix: list them as plain labels below the box. (/impeccable adapt)
- **[P1] Two scroll instructions compete.** "Scroll to walk through" bottom-right and the docked "/Globe — Scroll to bend" bottom-left. Fix: show the docked hint only on hover. (/impeccable distill)
- **[P2] Chapter 04 FACE is a dead end with no closing beat.** (/impeccable clarify)
- **[P2] Pressable FACE callouts look identical to static labels.** Fix: the site's dashed-underline link idiom. (/impeccable clarify)
- **[P3] Chapter buttons are about 62×15 on phone.** (/impeccable adapt)

Detector: 8 findings. The 10px chapter nav is real; the eyebrow and ASCII findings are false positives.
