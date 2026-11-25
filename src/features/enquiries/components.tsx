import { requireSession } from "@/features/auth/session";
import { enquiries } from "./queries";
import { EnquiryForm } from "./form";
import { followUp } from "./actions";
import { PageTitle, Empty, Status } from "@/components/ui/shared";
import { ActionForm } from "@/components/ui/action-form";
export async function EnquiriesView() {
  const [actor, records] = await Promise.all([
    requireSession("enquiries"),
    enquiries(),
  ]);
  return (
    <>
      <PageTitle
        eyebrow={
          actor.role === "customer"
            ? "A direct line to Census"
            : "Staff follow-up queue"
        }
        title="Every request starts a conversation."
      >
        Enquiries are kept separate from orders, invoices, and sales totals.
      </PageTitle>
      <details className="panel details" open={actor.role === "customer"}>
        <summary>Send a new enquiry</summary>
        <EnquiryForm />
      </details>
      <div className="record-list" style={{ marginTop: 25 }}>
        {!records.length && <Empty>No enquiries to show.</Empty>}
        {records.map((e) => (
          <article className="panel" key={e.id}>
            <div className="record-header">
              <div>
                <h3>
                  {e.reference} · {e.contact_name}
                </h3>
                <p className="record-meta">
                  {new Date(e.created_at).toLocaleDateString("en-GB")} ·{" "}
                  {e.email} · {e.phone}
                </p>
              </div>
              <Status>{e.status.replaceAll("_", " ")}</Status>
            </div>
            <p>{e.request}</p>
            {e.quantity && (
              <p className="muted">Requested quantity: {e.quantity}</p>
            )}
            {e.notes && <p className="muted">{e.notes}</p>}
            {actor.role !== "customer" && (
              <details className="details">
                <summary>Update follow-up</summary>
                <ActionForm action={followUp} submit="Save follow-up">
                  <input name="id" type="hidden" value={e.id} />
                  <label>
                    Status
                    <select name="status" defaultValue={e.status}>
                      <option value="new">New</option>
                      <option value="following_up">Following up</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                </ActionForm>
              </details>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
