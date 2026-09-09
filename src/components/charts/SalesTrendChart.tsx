"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { CHART_INK, SEQUENTIAL_BLUE } from "@/lib/ui/chart-palette";
import { formatINR } from "@/lib/ui/format";

export function SalesTrendChart({ data }: { data: { month: string; value: number }[] }) {
  const hasAnySales = data.some((d) => d.value > 0);

  if (!hasAnySales) {
    return <p className="flex h-56 items-center justify-center text-sm text-text-muted">No sales recorded in this period yet.</p>;
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_INK.gridline} strokeDasharray="0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: CHART_INK.muted }}
            axisLine={{ stroke: CHART_INK.baseline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_INK.muted }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
          />
          <Tooltip
            cursor={{ stroke: CHART_INK.baseline, strokeWidth: 1 }}
            formatter={(value) => [formatINR(Number(value)), "Sales"]}
            contentStyle={{
              background: CHART_INK.surface,
              border: `1px solid ${CHART_INK.gridline}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: CHART_INK.secondary }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={SEQUENTIAL_BLUE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
