import { Field, Select, TextArea } from "../../components/Controls";
import type { PageSize, Party } from "../document-editor/model";

export interface Settings {
  currency: string;
  pageSize: PageSize;
  paymentTermsDays: number;
  businessProfile?: Party;
}

const emptyProfile = (): Party => ({ name: "", contact: "", email: "", phone: "", address: "", taxId: "", website: "" });

export function SettingsView({ settings, onChange, onClear }: { settings: Settings; onChange: (settings: Settings) => void; onClear: () => void }) {
  const profile = settings.businessProfile ?? emptyProfile();
  const updateProfile = (key: keyof Party, value: string) => onChange({ ...settings, businessProfile: { ...profile, [key]: value } });
  return (
    <main className="page" id="main-content">
      <div className="page-heading"><div><h1>Settings</h1><p>Defaults apply to new documents and stay in this browser on this device.</p></div></div>
      <section className="settings-panel">
        <h2>Document defaults</h2>
        <div className="field-grid three">
          <Select name="default-currency" label="Default currency" value={settings.currency} onChange={(event) => onChange({ ...settings, currency: event.target.value })}>
            {["USD", "KES", "EUR", "GBP", "NGN", "ZAR", "CAD", "AUD", "INR", "JPY", "AED"].map((code) => <option key={code}>{code}</option>)}
          </Select>
          <Select name="default-page" label="Default page size" value={settings.pageSize} onChange={(event) => onChange({ ...settings, pageSize: event.target.value as PageSize })}>
            <option value="A4">A4</option><option value="LETTER">US Letter</option>
          </Select>
          <Field name="default-terms-days" label="Payment terms (days)" type="number" min={0} max={365} value={settings.paymentTermsDays} onChange={(event) => onChange({ ...settings, paymentTermsDays: Math.max(0, Math.min(365, Number(event.target.value) || 0)) })} />
        </div>
      </section>
      <section className="settings-panel">
        <h2>Saved business profile</h2>
        <p>These details fill new documents. Leave every field blank to keep no profile.</p>
        <div className="field-grid">
          <Field name="profile-name" label="Business name" value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} />
          <Field name="profile-contact" label="Contact person" value={profile.contact} onChange={(event) => updateProfile("contact", event.target.value)} />
          <Field name="profile-email" label="Email" type="email" value={profile.email} onChange={(event) => updateProfile("email", event.target.value)} />
          <Field name="profile-phone" label="Phone" type="tel" value={profile.phone} onChange={(event) => updateProfile("phone", event.target.value)} />
          <TextArea name="profile-address" label="Postal address" rows={3} value={profile.address} onChange={(event) => updateProfile("address", event.target.value)} />
          <Field name="profile-tax" label="Tax or registration ID" value={profile.taxId} onChange={(event) => updateProfile("taxId", event.target.value)} />
          <Field name="profile-website" label="Website" type="url" value={profile.website} onChange={(event) => updateProfile("website", event.target.value)} />
        </div>
      </section>
      <section className="danger-zone"><h2>Local data</h2><p>Clearing local data removes saved documents and settings from this browser.</p><button className="destructive" type="button" onClick={onClear}>Clear local data</button></section>
    </main>
  );
}
