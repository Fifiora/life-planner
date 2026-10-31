# Polish and groceries implementation plan

> For agentic workers: use superpowers:executing-plans (the user chose inline execution); steps are tracked as tasks in the harness.

**Spec:** docs/superpowers/specs/2026-10-31-polish-groceries-design.md

**Order and tests (each: failing test pushed first, then implementation, CI green):**
1. Back button: `DaySheet` shows a "Back to calendar" button in day view (closes) and "Back" in the event form (returns to day view). Tests in `tests/calendarScreen.test.tsx`.
2. Donut: `categoryBreakdown(category, bills, expenses, month, income, previousMonth)` in `src/lib/ledger.ts` (tests in `tests/ledger.test.ts`); `Donut` gets selection state, `aria-pressed` rows, `data-dimmed`, tooltip, and a `detail` panel (tests in `tests/charts.test.tsx`); Overview passes the breakdown.
3. Receipts: `src/lib/receipts.ts` (`ReceiptStore` interface, IndexedDB implementation with in-memory fallback, `compressImage`), `src/ui/ReceiptLogger.tsx` used in `Food.tsx`, `Expense.receipt_id?`, photo removal when an expense is deleted. Tests: amount-only save, photo save via injected store, invalid amount, view-only hidden, groceries budget updates, delete removes photo.
4. Farmers market: `routinesOn` matches monthly/quarterly routines that have a weekday on that weekday; `src/lib/migrate.ts` (`adjustPlan`, `migrateOwnData`) wired into `main.tsx`, `StarterPlanLoader` and `UnlockPreload`. Tests in `tests/calendar.test.ts` and `tests/migrate.test.ts`.
5. Audit: checklist of original requirements against code; failing tests for each real miss; fixes.
6. Look and layout: palette variables (light/dark), glass cards, hover/press, wide-screen sidebar and grid, `wide` class on full-width cards. Verified by build and, if reachable, Playwright screenshots at phone and laptop sizes.
7. Whole-branch review, fix Critical/Important test-first, README.
