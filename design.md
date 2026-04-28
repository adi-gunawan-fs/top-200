# UI Design System — Top 200 Brands

A reference for anyone building UI in this codebase: developers, designers, or AI tools.
The goal is visual consistency across all components without changing the existing design.

---

## Stack

- **React 19** with functional components and hooks
- **Tailwind CSS 3** utility classes — no CSS modules, no styled-components, no inline `style={{}}` except for dynamic values (e.g. tree indentation)
- **lucide-react** for all icons

---

## Color System

Five semantic groups. Do not introduce new colors outside these.

| Role | Background | Text | Border |
|---|---|---|---|
| New / Success | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| Updated / Warning | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| Deleted / Error | `bg-rose-50` | `text-rose-700` | `border-rose-200` |
| Info / Selected | `bg-blue-50` | `text-blue-700` | `border-blue-200` |
| Neutral / Unchanged | `bg-slate-50` | `text-slate-600` | `border-slate-200` |

Row background tints (for table rows):

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
| Muted / secondary | `text-xs text-slate-500` or `text-slate-600` |
| Table header | `text-[11px] uppercase tracking-wide text-slate-600` |
| Badge / pill label | `text-[10px] font-semibold uppercase tracking-wide` |
| Small detail | `text-[11px] text-slate-600` |

Rules:
- Use `font-semibold` or `font-medium` — never `font-bold`
- Use `text-xs` (12px) or smaller for all data — never `text-sm` or larger in tables
- Do not write multi-line comments or docstrings in components

---

## Spacing & Layout

| Context | Class |
|---|---|
| Card / section padding | `p-4` |
| Table cell padding | `px-3 py-2` |
| Compact header padding | `px-3 py-2` |
| Gap between flex children | `gap-2`, `gap-3`, or `gap-4` |
| Gap between badge/pill items | `gap-1` or `gap-1.5` |

---

## Cards & Sections

All standalone sections use this shell:

```
rounded-lg border border-slate-200 bg-white shadow-sm
```

Section headers (inside a card, above content):

```
border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700
```

---

## Badges & Pills

Standard pill shape — apply the appropriate color group from the color system:

```
inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
```

Example — a "New" status pill:
```jsx
<span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
  New
</span>
```

Use the shared components in `src/components/ui/` instead of writing raw spans:

| Component | File | When to use |
|---|---|---|
| `<StatusPill status="new" />` | `ui/StatusPill.jsx` | new / updated / deleted / unchanged |
| `<CurationPill required={true} />` | `ui/CurationPill.jsx` | curation requirement |
| `<ChallengeBadge challenge="Hard" />` | `ui/ChallengeBadge.jsx` | Hard / Easy |
| `<ChangeTypeBadge type="Relevant" />` | `ui/ChangeTypeBadge.jsx` | Relevant / Not Relevant |
| `<ChangeTypeCounts counts={...} />` | `ui/ChangeTypeBadge.jsx` | relevancy summary counts |
| `<SummaryTriple label="Dishes" deleted={0} added={2} updated={1} />` | `ui/SummaryTriple.jsx` | deleted/new/updated count block |

---

## Buttons

Default (neutral action):
```
rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100
```

Primary action:
```
rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100
```

Disabled state (append to any button):
```
disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400
```

Always include `type="button"` on non-submit buttons to prevent accidental form submission.

---

## Form Controls

Select:
```
rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none
```

Checkbox:
```
h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500
```

Checkbox label wrapper:
```
inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50
```

---

## Tables

All tables use:
```
min-w-full table-fixed border-collapse
```

Table header row:
```
bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600
```

Sticky column headers (inside scrollable containers):
```
sticky top-0 z-20 bg-slate-100
```

Row separator:
```
border-b border-slate-100
```

Apply row background via `rowStyles(status)` from `src/components/ui/StatusPill.jsx`.

---

## Icons

All icons come from `lucide-react`. No other icon libraries.

| Context | Size |
|---|---|
| Inline with text | `h-3.5 w-3.5` |
| Standalone / button | `h-4 w-4` |
| Small inline (e.g. external link) | `h-3 w-3` |

---

## File & Component Conventions

### Where new files go

| Type | Location |
|---|---|
| Reusable UI primitive (badge, pill, button) | `src/components/ui/` |
| Feature component (table, page section) | `src/components/` |
| Data transformation / business logic | `src/utils/` |

### Existing shared utilities — always import, never re-implement

| Utility | File | Exports |
|---|---|---|
| Date formatting | `src/utils/formatDate.js` | `formatDate`, `parseDateValue` |
| Hierarchy building | `src/utils/hierarchyUtils.js` | `buildHierarchy`, `collectTitleIds` |
| Filtering / counting | `src/utils/filterUtils.js` | `filterChangedFieldsByRelevancy`, `hasVisibleChangedFields`, `getVisibleChangeTypeCounts`, `getTotalVisibleChangeTypeCounts`, `countVisibleStatuses`, `filterHierarchyByStatus`, `filterHierarchyByRelevancy` |
| Export / download | `src/utils/exportComparison.js` | `buildComparisonExport`, `downloadExportFile` |
| Diff logic | `src/utils/compareMessages.js` | `compareMessages`, `CHANGE_TYPE_RULES`, `CHALLENGE_RULES` |

### What not to do

- Do not duplicate `formatDate` — it exists in `src/utils/formatDate.js`
- Do not inline badge/pill markup — use the shared components in `src/components/ui/`
- Do not introduce colors outside the five semantic groups
- Do not use `text-sm` or larger in data tables
- Do not use `font-bold`
- Do not add CSS modules, styled-components, or custom CSS classes
- Do not use inline `style={{}}` except for dynamic computed values (e.g. `paddingLeft` for tree depth indentation)
