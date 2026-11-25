import Link from "next/link";
import { collectionsReport } from "./queries";
import { invoices } from "@/features/billing/queries";
import { InvoiceRecord } from "@/features/billing/components";
import { money } from "@/features/billing/money";
import { DateFilter } from "@/features/reporting/components";
import type { DateFilters } from "@/features/reporting/queries";
import { PageTitle, Empty } from "@/components/ui/shared";
export async function CollectionsView({ filters }: { filters: DateFilters }) {
  const [report, records] = await Promise.all([
    collectionsReport(filters),
    invoices(),
  ]);
  return (
    <>
      <PageTitle
        eyebrow="Accounts & collections"
        title="Every balance, accounted for."
      >
        Balances are current across all issued invoices. The date filter applies
        to eligible collections by payment date.
      </PageTitle>
      <DateFilter filters={filters} />
      <div className="metric-grid">
        <div className="panel metric">
          <span className="eyebrow">Total outstanding</span>
          <strong>{money(report.outstanding_minor)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Collections in period</span>
          <strong>{money(report.collection_minor)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Pending cheques</span>
          <strong>{report.pending.length}</strong>
        </div>
      </div>
      <div className="panel">
        <h3>Balances by customer</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoiced</th>
                <th>Eligible payments</th>
                <th>Outstanding</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {report.balances.map((c) => (
                <tr key={c.id}>
                  <td>{c.shop_name}</td>
                  <td>{money(c.invoiced_minor)}</td>
                  <td>{money(c.paid_minor)}</td>
                  <td>
                    {money(BigInt(c.invoiced_minor) - BigInt(c.paid_minor))}
                  </td>
                  <td>
                    <Link
                      className="text-link"
                      href={`?from=${filters.from || ""}&to=${filters.to || ""}&customer=${c.id}#ledger`}
                    >
                      View ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 25 }}>
        <h3>Pending cheque register</h3>
        {!report.pending.length ? (
          <Empty>No pending cheques.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer / invoice</th>
                  <th>Cheque / bank</th>
                  <th>Cheque date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.pending.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.shop_name} / {p.reference}
                    </td>
                    <td>
                      {p.cheque_number} / {p.bank}
                    </td>
                    <td>{p.cheque_date}</td>
                    <td>{money(p.amount_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div id="ledger" style={{ marginTop: 35 }}>
        <h2>Underlying invoices & payments</h2>
        <p className="muted">
          Up to 500 recent invoices. Totals above use all database records.
        </p>
        {filters.customer && (
          <Link className="text-link" href="/workspace/collections">
            Clear customer filter
          </Link>
        )}
        <div className="record-list" style={{ marginTop: 25 }}>
          {records
            .filter(
              (i) => !filters.customer || i.customer_id === filters.customer,
            )
            .map((i) => (
              <InvoiceRecord invoice={i} key={i.id} />
            ))}
        </div>
      </div>
    </>
  );
}
