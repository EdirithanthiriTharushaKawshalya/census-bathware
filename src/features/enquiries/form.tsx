import { ActionForm } from "@/components/ui/action-form";
import { submitEnquiry } from "./actions";
export function EnquiryForm() {
  return (
    <ActionForm lockOnSuccess action={submitEnquiry} submit="Send enquiry">
      <input type="hidden" name="key" value={crypto.randomUUID()} />
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            defaultValue=""
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Contact name
          <input
            name="contact_name"
            required
            minLength={2}
            maxLength={150}
            autoComplete="name"
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            required
            minLength={5}
            maxLength={40}
            autoComplete="tel"
          />
        </label>
        <label>
          Quantity, if known
          <input name="quantity" type="number" min="1" max="100000" step="1" />
        </label>
      </div>
      <label>
        Products or general enquiry
        <textarea
          name="request"
          required
          minLength={3}
          maxLength={2000}
          placeholder="Tell us what you’re looking for. Include a SKU if you know it."
        />
      </label>
      <label>
        Additional notes
        <textarea name="notes" maxLength={4000} />
      </label>
      <p className="muted">
        Your contact details are shared only with our follow-up team. An enquiry
        does not place an order.
      </p>
    </ActionForm>
  );
}
