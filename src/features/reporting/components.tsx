import { PageTitle, Empty } from "@/components/ui/shared";
import { money } from "@/features/billing/money";
import { salesReport, dates, type DateFilters } from "./queries";
export function DateFilter({ filters }: { filters: DateFilters }) {
  const range = dates(filters);
  return (
    <form className="filters">
      <label>
        From
        <input type="date" name="from" defaultValue={range.from} required />
      </label>
      <label>
        To
        <input type="date" name="to" defaultValue={range.to} required />
      </label>
      <button className="button">Apply dates</button>
    </form>
  );
}
export async function ReportsView({ filters }: { filters: DateFilters }) {
  const { report } = await salesReport(filters);
  const max = Math.max(
    1,
    ...report.monthly.map((m) => Number(m.invoiced_minor)),
  );
  return (
    <>
      <PageTitle eyebrow="Performance" title="See the bigger picture.">
        Ordered value, issued invoice value, and actual fulfilment are separate
        measures. Representative accounts see their own attributed orders.
      </PageTitle>
      <DateFilter filters={filters} />
      <div className="metric-grid">
        <div className="panel metric">
          <span className="eyebrow">Ordered in period</span>
          <strong>{money(report.ordered_minor)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Invoiced in period</span>
          <strong>{money(report.invoiced_minor)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Fulfilled on period’s orders</span>
          <strong>{money(report.fulfilled_minor)}</strong>
        </div>
      </div>
      <div className="panel">
        <h3>Monthly invoiced sales</h3>
        {report.monthly.map((m) => (
          <div className="chart-row" key={m.month}>
            <span>{m.month}</span>
            <div
              className="chart-bar"
              aria-label={`${m.month}: ${money(m.invoiced_minor)}`}
            >
              <i
                style={{ width: `${(Number(m.invoiced_minor) / max) * 100}%` }}
              />
            </div>
            <span>{money(m.invoiced_minor)}</span>
          </div>
        ))}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Ordered</th>
                <th>Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {report.monthly.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{money(m.ordered_minor)}</td>
                  <td>{money(m.invoiced_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 25 }}>
        <h3>Sales by representative</h3>
        {!report.representatives.length ? (
          <Empty>No sales in this date range.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Representative</th>
                  <th>Ordered</th>
                  <th>Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {report.representatives.map((r) => (
                  <tr key={r.rep_id || "none"}>
                    <td>{r.name}</td>
                    <td>{money(r.ordered_minor)}</td>
                    <td>{money(r.invoiced_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="notice">
        Profit reporting awaits an approved cost basis and calculation.
        Enquiries are excluded from all sales totals. Date boundaries use the
        database timezone (UTC by default).
      </p>
    </>
  );
}
