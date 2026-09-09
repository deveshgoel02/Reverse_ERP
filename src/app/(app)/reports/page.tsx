import { Card, CardHeader } from "@/components/ui/Card";

const REPORTS = [
  { type: "inventory", label: "Inventory Report", desc: "Every active SKU: stock, value, age, status." },
  { type: "sales", label: "Sales Report", desc: "Full sales transaction history." },
  { type: "purchases", label: "Purchase Report", desc: "Full purchase order history, ordered vs. received." },
  { type: "outstanding-stock", label: "Outstanding Stock Report", desc: "Stock deadlines still open or missed." },
  { type: "dead-stock", label: "Dead Stock Report", desc: "SKUs currently classified as dead stock." },
  { type: "slow-moving", label: "Slow-Moving Stock Report", desc: "SKUs currently classified as slow-moving." },
  { type: "aging", label: "Inventory Aging Report", desc: "Every SKU ranked by days since first received." },
  { type: "brand-performance", label: "Brand Performance Report", desc: "Stock, value, and sales rolled up by brand." },
  { type: "sku-performance", label: "SKU Performance Report", desc: "Sell-through rate per SKU." },
  { type: "customers", label: "Customer Report", desc: "Orders and spend per customer." },
  { type: "suppliers", label: "Supplier Report", desc: "Order volume and open orders per supplier." },
  { type: "forecast", label: "Forecast Report", desc: "Latest demand forecast per SKU." },
  { type: "recommended-purchase", label: "Recommended Purchase Report", desc: "All pending order-more recommendations." },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Reports</h1>
        <p className="text-sm text-text-muted">Export any report as CSV, ready to open in Excel.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type}>
            <CardHeader title={r.label} subtitle={r.desc} />
            <a
              href={`/api/reports/${r.type}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-bg"
            >
              Download CSV
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
