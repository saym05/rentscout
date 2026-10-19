# Design
Direction: calm, trustworthy, printed-guide feel — not a generic dashboard.
- Palette: warm paper `#F7F3EC`, card `#FFFFFF`, navy ink `#14213D`, muted teal accent `#2A7F78`, soft sage surface `#E4EDE8`, warning ochre `#B7791F`, error brick `#B3392F`. Text on paper ≥ 4.5:1.
- Type: serif display for headlines (e.g. Fraunces), humanist sans for UI (e.g. Source Sans 3), tabular figures for prices.
- Price hierarchy: monthly total large and navy; beneath it rent + utilities in small type; converted prices show "≈" with rate/date tooltip; original currency always visible.
- Cards: photo area with neutral fallback pattern, source chip, DEMO badge, heart toggle, compare checkbox.
- Layout: filter rail left on desktop, drawer on mobile; comparison table on desktop, stacked cards on mobile.
- Avoid: gradients, glassmorphism, stock illustrations, decorative motion. Motion ≤ 150 ms.
- References: Idealista/Zillow density without clutter, Airbnb card clarity, Wise's transparent fee display, printed travel guides for typography.
- Design tool: none was available in this environment; this document plus the tokens are the reference for the coding agent. If Claude Design/Lovable/v0 is used later, record the prompt and output here.
- 2026-10-20 polish: sticky header with pill nav, a "worked example" receipt in the hero (illustration, not a listing), elevated cards with simple SVG building art per property type (no stock photos), pill buttons, ruled breakdown totals, highlighted cheapest column in compare. Contrast pairs re-checked (all ≥ 4.5:1).
- 2026-10-20 landing redesign: hero + worked-example receipt, city cards (live counts and cheapest price from the API, labelled demo), how-it-works steps, duplicate-hint feature panel, illustrative personas (labelled as such), navy CTA band. The top demo banner was removed at the user's request; demo labelling remains via DEMO badges on every listing and a footer note.
