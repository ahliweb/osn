---
"osn-informatika-2026": patch
---

Upgrade Biome from 1.9.4 to 2.x and migrate `biome.json` to the Biome 2
configuration schema, preserving the same formatter, linter and
import-organisation intent. Fixes the lint findings Biome 2's expanded
recommended rule set surfaced, in the code rather than by suppressing them.
