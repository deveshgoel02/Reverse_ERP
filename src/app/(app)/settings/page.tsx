import { getCurrentUser } from "@/lib/auth/current-user";
import { getSettings } from "@/lib/settings/get";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveSettings } from "./actions";

const FIELDS: { key: string; label: string; help: string }[] = [
  { key: "slowMovingDays", label: "Slow Moving (days since last sale)", help: "Beyond this, a SKU is flagged Slow Moving." },
  { key: "atRiskDays", label: "At Risk (days since last sale)", help: "Beyond this, a SKU is flagged At Risk." },
  { key: "deadStockDays", label: "Dead Stock (days since last sale)", help: "Beyond this with minimal recent sales, a SKU is Dead Stock." },
  { key: "deadStockMinUnitsSold", label: "Dead Stock — min units to not count as dead", help: "Even past the dead-stock day threshold, this many recent units sold keeps it out of Dead Stock." },
  { key: "overstockedDaysCover", label: "Overstocked (days of cover)", help: "Current stock ÷ recent daily velocity above this = Overstocked." },
  { key: "understockedDaysCover", label: "Understocked (days of cover)", help: "Current stock ÷ recent daily velocity below this = Understocked." },
  { key: "defaultSafetyStockDays", label: "Default Safety Stock (days)", help: "Used in reorder point calculations when a SKU has no override." },
  { key: "defaultLeadTimeDays", label: "Default Supplier Lead Time (days)", help: "Used when a supplier has no lead time recorded." },
  { key: "highExposureValueThreshold", label: "High Exposure Threshold (₹ per brand)", help: "Above this inventory value for one brand, raise a High Exposure alert." },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const settings = await getSettings(user.businessId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Settings</h1>
        <p className="text-sm text-text-muted">
          Every threshold the classification, alert, and recommendation engines use — tune them for your business instead of relying on hard-coded defaults.
        </p>
      </div>

      <Card>
        <CardHeader title="Business-Wide Thresholds" />
        <form action={saveSettings} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-text">{f.label}</label>
                <input
                  name={f.key}
                  type="number"
                  defaultValue={String(settings[f.key as keyof typeof settings])}
                  className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-xs text-text-muted">{f.help}</p>
              </div>
            ))}
          </div>
          <Button type="submit" variant="primary">
            Save Settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
