---
"osn-informatika-2026": minor
---

Upgrade Zod from 3.x to 4.x, the validation library backing every schema in
the curriculum corpus, and migrate the one deprecated call site
(`z.string().url()` → `z.url()`). Validation behaviour is unchanged, verified
by probing the schemas that carry security or correctness weight rather than
relying on the test suite alone.
