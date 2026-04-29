# UI Design System — Top 200 Brands

A reference for anyone building UI in this codebase: developers, designers, or AI tools.
The goal is visual consistency through a small set of enforced primitives.

**Light mode only. No dark mode classes anywhere.**

---

## Stack

- **React 19** with functional components and hooks
- **Tailwind CSS 3** utility classes — no CSS modules, no styled-components, no inline `style={{}}` except for dynamic values (e.g. tree indentation)
- **lucide-react** for all icons

---

## Primitives — always use these, never inline

All primitives live in `src/components/ui/`. Before writing markup, check this list. If a primitive doesn't fit, propose adding/extending one — don't inline a one-off.

| Primitive | File | Use for |
|---|---|---|
| `<Button variant tone size>` | `Button.jsx` | every button. variants: `outline` (default), `tonal`, `solid`, `ghost`. tones: `neutral`, `info`, `success`, `warning`, `danger`, `ai`. sizes: `xs`, `sm` (default), `md`, `lg` |
| `<IconButton tone size>` | `Button.jsx` | square icon-only buttons (close, action toggles) |
| `<Badge tone size uppercase>` | `Badge.jsx` | every pill / chip. Same tone palette as `Button`. `uppercase={false}` for label-style pills like "Deleted: 3" |
| `<Modal title subtitle onClose footer size>` | `Modal.jsx` | every dialog. Always portaled, focus-trapped, ESC-closable, scroll-locked |
| `<ConfirmDialog>` | `ConfirmDialog.jsx` | yes/no confirmation flows |
| `<Card>`, `<Card.Header>`, `<Card.Toolbar>`, `<Card.Body>` | `Card.jsx` | every standalone section / table shell |
| `<KpiTile label>` | `KpiTile.jsx` | the small slate-50 stat tiles in page headers |
| `<EmptyState message tone>` | `EmptyState.jsx` | empty list, loading state, top-level error |
| `<StatusPill status>` | `StatusPill.jsx` | new / updated / deleted / unchanged |
| `<CurationPill required>` | `CurationPill.jsx` | curation requirement |
| `<ChallengeBadge challenge>` | `ChallengeBadge.jsx` | Hard / Easy |
| `<ChangeTypeBadge type>` / `<ChangeTypeCounts>` | `ChangeTypeBadge.jsx` | Relevant / Not Relevant |
| `<SummaryTriple label deleted added updated bare>` | `SummaryTriple.jsx` | deleted/new/updated count block. `bare` skips the KpiTile shell (use inside table cells) |

**Hard rule:** never copy the inline classes from a primitive's source — import the primitive.

---

## Color System

Six semantic tones — used by `Button`, `Badge`, and everywhere else. Never introduce new hues.

| Tone | Use | Color family |
|---|---|---|
| `neutral` | unchanged, default | slate |
| `info` | selected, primary action, "updated" counts | blue |
| `success` | new / created / resolved | emerald |
| `warning` | needs review / updated rows | amber |
| `danger` | deleted / errors / "Relevant" highlight | rose |
| `ai` | AI / analysis affordances | violet |

Row background tints (for table rows, via `rowStyles(status)` from `StatusPill.jsx`):

| Status | Class |
|---|---|
| new | `bg-emerald-50/40` |
| updated | `bg-amber-50/50` |
| deleted | `bg-rose-50/40` |
| unchanged | `bg-white` |

---

## Typography

| Use | Class |
|---|---|
| Page title | `text-base font-semibold text-slate-900` |
| Section heading | `text-xs font-semibold text-slate-700` |
| Body / table cells | `text-xs text-slate-700` |
| Muted / secondary | `text-xs text-slate-500` |
| Table header | `text-[11px] uppercase tracking-wide text-slate-600` |
| Badge label | handled by `<Badge>` (`text-[10px] font-semibold uppercase tracking-wide`) |
| Small detail | `text-[11px] text-slate-600` |

Rules:
- Use `font-semibold` or `font-medium` — **never `font-bold`**
- Use `text-xs` (12px) or smaller for all data — never `text-sm` or larger in tables
- No multi-line comments or docstrings in components

---

## Spacing & Layout

| Context | Class |
|---|---|
| Card body padding | `p-4` (use `<Card.Body>`) |
| Card header / toolbar padding | `px-3 py-2` (handled by `<Card.Header>` / `<Card.Toolbar>`) |
| Table cell padding | `px-3 py-2` |
| Button size `sm` | `px-2 py-1` |
| Button size `md` | `px-3 py-1.5` |
| Gap between flex children | `gap-2`, `gap-3`, or `gap-4` |
| Gap between badge/pill items | `gap-1.5` |
| Stack of cards | `gap-4` |

---

## Tables

Every table lives inside a `<Card>`. Standard markup:

```jsx
<Card>
  <Card.Header>{title}</Card.Header>
  <Card.Toolbar>{filters}</Card.Toolbar>
  <div className="overflow-x-auto">
    <table className="min-w-full table-fixed border-collapse">
      <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
        ...
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(row.status)}`}>
            ...
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>
```

For sticky headers inside scroll containers, add `sticky top-0 z-20 bg-slate-100` to each `<th>`.

---

## Forms

Inputs:
```
rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400
```

Checkbox:
```
h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500
```

Checkbox-chip wrapper (filter rows):
```
inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50
```

`<RecordSelect>` is the standard `<select>` wrapper for record/option pickers.

---

## Icons

All icons come from `lucide-react`. No other icon libraries.

| Context | Size |
|---|---|
| Inline with text | `h-3.5 w-3.5` |
| Standalone / button | `h-4 w-4` |
| Small inline (e.g. external link, micro) | `h-3 w-3` |

---

## File & Component Conventions

| Type | Location |
|---|---|
| Reusable UI primitive (Button, Badge, Modal, Card, KpiTile, EmptyState) | `src/components/ui/` |
| Feature component (page, table, section) | `src/components/` |
| Data transformation / business logic | `src/utils/` |
| Data access / external services | `src/lib/` |

### Existing shared utilities — always import, never re-implement

| Utility | File |
|---|---|
| Date formatting | `src/utils/formatDate.js` (`formatDate`, `parseDateValue`) |
| Hierarchy building | `src/utils/hierarchyUtils.js` |
| Filtering / counting | `src/utils/filterUtils.js` |
| Export / download | `src/utils/exportComparison.js` |
| Diff logic | `src/utils/compareMessages.js` |

### Hard "do not"s

- Do not inline a button — use `<Button>` / `<IconButton>`
- Do not inline a pill or badge — use `<Badge>` (or one of the semantic wrappers)
- Do not write a one-off modal — use `<Modal>` / `<ConfirmDialog>`
- Do not write a card shell — use `<Card>`
- Do not introduce colors outside the six semantic tones
- Do not use `text-sm` or larger in data tables
- Do not use `font-bold`
- Do not add CSS modules, styled-components, or custom CSS classes
- Do not duplicate `formatDate`, hierarchy logic, or filter logic

---

## Standard "build a feature" prompt

When adding a feature, paste the following expectations into your context:

1. Use existing primitives. Never inline a button/pill/modal/card/KPI tile.
2. Color is semantic only (`neutral | info | success | warning | danger | ai`).
3. Type scale is fixed: `text-base` for page titles, `text-xs` for everything in data, never `text-sm` in tables, never `font-bold`.
4. Every interactive element has hover + focus rings. Buttons get `type="button"` unless they submit.
5. Modals: portal + focus-trap + ESC + scroll-lock (use `<Modal>`).
6. Custom dropdowns expose `aria-haspopup` + `aria-expanded` and ideally arrow-key navigation.
7. Clickable rows are keyboard-activatable (`role="button"`, `tabIndex={0}`, Enter/Space handlers).
8. Empty / loading / error states must exist for every list (`<EmptyState>`).
9. No comments unless the *why* is non-obvious.
10. `grep` before creating a component — use the existing one or extend it.
