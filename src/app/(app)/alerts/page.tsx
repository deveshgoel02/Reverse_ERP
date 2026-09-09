import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { AlertRow } from "./AlertRow";

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const alerts = await prisma.alert.findMany({
    where: { businessId: user.businessId, status: "OPEN" },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Alerts</h1>
        <p className="text-sm text-text-muted">{alerts.length} open alerts across all types.</p>
      </div>

      <Card>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">No open alerts. Everything looks clear.</p>
        ) : (
          <ul>
            {alerts.map((a) => (
              <AlertRow
                key={a.id}
                id={a.id}
                type={a.type}
                severity={a.severity}
                message={a.message}
                createdAt={a.createdAt.toISOString()}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
