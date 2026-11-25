import { money } from "@/features/billing/money";
import { PageTitle, Status } from "@/components/ui/shared";
export function DemoOverview() {
  return (
    <>
      <PageTitle
        eyebrow="Development preview / Fictional data"
        title="A considered way to work."
      >
        This read-only sample is separate from the authenticated portal. No
        accounts or business records are accessed.
      </PageTitle>
      <div className="metric-grid">
        <div className="panel metric">
          <span className="eyebrow">Sample ordered value</span>
          <strong>{money(24750000)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Sample outstanding</span>
          <strong>{money(12600000)}</strong>
        </div>
        <div className="panel metric">
          <span className="eyebrow">Sample deliveries today</span>
          <strong>3</strong>
        </div>
      </div>
      <div className="panel">
        <h3>Sample order activity</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Ordered value</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DEMO-1042</td>
                <td>Perera Hardware</td>
                <td>{money(5550000)}</td>
                <td>
                  <Status>Out for delivery</Status>
                </td>
              </tr>
              <tr>
                <td>DEMO-1041</td>
                <td>Southern Home Centre</td>
                <td>{money(11850000)}</td>
                <td>
                  <Status>Partial</Status>
                </td>
              </tr>
              <tr>
                <td>DEMO-1040</td>
                <td>City Tile Studio</td>
                <td>{money(7350000)}</td>
                <td>
                  <Status>Delivered</Status>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
