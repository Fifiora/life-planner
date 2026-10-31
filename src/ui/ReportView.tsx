import { reportSections } from '../lib/reportText'
import type { MemberRef, Report } from '../lib/reportTypes'
import { FocusBox } from './FocusBox'

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Every section of the report as a card, then next month's focus. */
export function ReportView({ report, members }: { report: Report; members: MemberRef[] }) {
  return (
    <>
      <FocusBox month={report.month} mode="review" />
      {reportSections(report, members).map((s) => (
        <section key={s.title} className="card report-card" aria-labelledby={`rep-${slug(s.title)}`}>
          <h2 id={`rep-${slug(s.title)}`}>{s.title}</h2>
          <ul className="list">
            {(s.lines.length > 0 ? s.lines : [s.emptyText]).map((line, i) => (
              <li key={i} className={s.lines.length > 0 ? 'list-row' : 'list-row muted'}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <FocusBox month={report.month} mode="plan" />
    </>
  )
}
