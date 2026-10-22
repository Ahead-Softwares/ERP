import { db } from './db';
import { financialYear } from './gst';

// BIL-02: per-tenant document number series per financial year, never reused.
// The row lock from UPDATE ... RETURNING serialises concurrent callers.

const DEFAULT_PREFIX: Record<string, string> = { invoice: 'INV', quotation: 'QT', receipt: 'RCT' };

export async function allocateNumber(tenantId: string, docType: 'invoice' | 'quotation' | 'receipt', fyStartMonth: number, at = new Date()) {
  const fy = financialYear(at, fyStartMonth);
  const tx = db();
  const prefix = `${DEFAULT_PREFIX[docType]}/${fy}/`;
  await tx.$executeRaw`INSERT INTO tenant_sequences (tenant_id, doc_type, fy, prefix, next_no) VALUES (${tenantId}::uuid, ${docType}, ${fy}, ${prefix}, 1) ON CONFLICT DO NOTHING`;
  const rows = await tx.$queryRaw<{ prefix: string; allocated: number }[]>`
    UPDATE tenant_sequences SET next_no = next_no + 1
     WHERE tenant_id = ${tenantId}::uuid AND doc_type = ${docType} AND fy = ${fy}
    RETURNING prefix, (next_no - 1)::int AS allocated`;
  const { prefix: p, allocated } = rows[0];
  // GST invoice numbers are at most 16 characters (e.g. INV/26-27/000123)
  return { fy, number: `${p}${String(allocated).padStart(4, '0')}` };
}
