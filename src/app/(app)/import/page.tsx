import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { formatDate } from "@/lib/ui/format";
import { UploadForm } from "./UploadForm";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const imports = await prisma.import.findMany({
    where: { businessId: user.businessId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Import Data</h1>
        <p className="text-sm text-text-muted">
          Bring in historical or current Excel/CSV files. Your original file is always preserved — nothing overwrites raw data.
        </p>
      </div>

      <UploadForm />

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>File</Th>
            <Th>Type</Th>
            <Th>Uploaded</Th>
            <Th className="text-right">Rows</Th>
            <Th>Status</Th>
          </Thead>
          <Tbody>
            {imports.length === 0 && <EmptyRow colSpan={5} message="No imports yet." />}
            {imports.map((imp) => (
              <Tr key={imp.id}>
                <Td>
                  <Link href={`/import/${imp.id}`} className="font-medium text-text hover:text-primary">
                    {imp.filename}
                  </Link>
                </Td>
                <Td>{imp.entityType}</Td>
                <Td className="text-text-muted">{formatDate(imp.createdAt)}</Td>
                <Td className="text-right tabular-nums">{imp.totalRows}</Td>
                <Td>
                  <Badge level={imp.status === "IMPORTED" ? "healthy" : imp.status === "FAILED" ? "critical" : "watch"}>
                    {imp.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
