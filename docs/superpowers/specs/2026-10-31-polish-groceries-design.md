# Interactive finance chart, grocery receipts, back button, look and laptop layout: design

Date: 2026-10-31. Approved in chat ("yes", with "build straight through"). No private data in this file (public repo). Device sync is a separate decision, not part of this spec.

## Scope
- **A. Back button:** the day sheet and the event form get an explicit "Back" control (the sheet's X stays).
- **B. Interactive donut (Finance Overview):** click a slice or legend row to select it; the others dim; a breakdown panel (right on wide screens, below on phones) lists that category's monthly bills and logged spending with amounts, its share of income and the change versus last month. Click it again, or the empty background, to restore all. Hover shows a tooltip and highlight.
- **C. Grocery receipts (Food):** a "Log a grocery receipt" card. Amount alone is enough; "Snap receipt" (camera or photo picker) is optional. Saves a Groceries expense (so the groceries budget, Finance Overview, Month vs Month and Insights update). Photos are downscaled in the browser and kept in the phone's IndexedDB, referenced by `receipt_id` on the expense; they are not in backups or shared copies. Deleting the expense deletes its photo. The amount is typed (no offline OCR).
- **D. Farmers market:** a routine with cadence monthly and a weekday shows on every such weekday ("a Tuesday in a month") until ticked that month. An existing weekly "Farmers market" routine is converted to monthly once (flag `lp.migrated.farmers`), and the same conversion is applied when the starter plan is loaded.
- **E. Gap audit:** check every original requirement against the app, fix misses, report.
- **F. Look and layout:** new light/dark palette, frosted-glass cards with a soft glossy highlight, hover/press effects, and a wide-screen layout (left sidebar, content up to about 72rem, cards in 2-3 columns, calendar and finance with side panels). Phone layout unchanged.

## Constraints
Everything stays on the phone; view-only mode shows no add/edit/delete controls; existing tests and labels keep working; CSS-only work is verified by build plus a real-browser screenshot when the deployed site is reachable.

## Testing
TDD through CI as before. Pure logic (breakdown, migration, routine days) unit-tested; components tested with the existing localStorage seed helpers; photo storage behind an injectable store so tests do not need a real IndexedDB or canvas.
