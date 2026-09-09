"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { CATEGORICAL_PALETTE, CHART_INK } from "@/lib/ui/chart-palette";
import { formatINR } from "@/lib/ui/format";

export function BrandValueChart({ data }: { data: { brand: string; value: number }[] }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="flex h-56 items-center justify-center text-sm text-text-muted">No inventory value recorded yet.</p>;
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_INK.gridline} />
          <XAxis dataKey="brand" tick={{ fontSize: 11, fill: CHART_INK.muted }} axisLine={{ stroke: CHART_INK.baseline }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_INK.muted }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
          />
          <Tooltip
            cursor={{ fill: CHART_INK.gridline, opacity: 0.4 }}
            formatter={(value) => [formatINR(Number(value)), "Inventory Value"]}
            contentStyle={{ background: CHART_INK.surface, border: `1px solid ${CHART_INK.gridline}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: CHART_INK.secondary }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, i) => (
              <Cell key={entry.brand} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
