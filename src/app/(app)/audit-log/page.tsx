import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const logs = await prisma.auditLog.findMany({
    where: { businessId: user.businessId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Audit Log</h1>
        <p className="text-sm text-text-muted">Every business-critical change: imports, merges, adjustments, and decisions.</p>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Note</Th>
          </Thead>
          <Tbody>
            {logs.length === 0 && <EmptyRow colSpan={5} message="No audit events yet." />}
            {logs.map((log) => (
              <Tr key={log.id}>
                <Td className="text-text-muted">{log.createdAt.toLocaleString("en-IN")}</Td>
                <Td>{log.actor?.name ?? "System"}</Td>
                <Td>{log.action.replace(/_/g, " ")}</Td>
                <Td className="font-mono text-xs">
                  {log.entityType} · {log.entityId.slice(0, 8)}
                </Td>
                <Td className="text-text-muted">{log.note ?? "—"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
