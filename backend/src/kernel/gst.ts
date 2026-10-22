// GST calculation (LLD §7.3, BIL-01). All money is integer paise (bigint); rounding is
// half-up to the paisa per line; document totals are sums of lines.
// GST logic must be validated by the client's CA before it is marketed as GST-compliant.

export const GST_RATES_BP = [0, 25, 300, 500, 1200, 1800, 2800] as const;

export interface LineInput {
  quantity: number; // up to 3 decimals
  unitPricePaise: number;
  discountPaise?: number;
  gstRateBp: number;
}

export interface LineTotals {
  quantityMilli: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalPaise: bigint;
}

export interface DocTotals {
  subtotalPaise: bigint;
  discountPaise: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalPaise: bigint;
}

/** round(n / d) half-up for non-negative bigint */
export const divRound = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);

export function computeLine(line: LineInput, intraState: boolean): LineTotals {
  const quantityMilli = BigInt(Math.round(line.quantity * 1000));
  const gross = divRound(BigInt(line.unitPricePaise) * quantityMilli, 1000n);
  const discount = BigInt(line.discountPaise ?? 0);
  const taxable = gross - discount < 0n ? 0n : gross - discount;
  const rate = BigInt(line.gstRateBp);
  let cgst = 0n;
  let sgst = 0n;
  let igst = 0n;
  if (intraState) {
    cgst = divRound(taxable * rate, 20_000n); // half the rate, rate in basis points
    sgst = cgst;
  } else {
    igst = divRound(taxable * rate, 10_000n);
  }
  return { quantityMilli, taxablePaise: taxable, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, totalPaise: taxable + cgst + sgst + igst };
}

export function computeDocument<T extends LineInput>(lines: T[], intraState: boolean) {
  const computed = lines.map((l) => ({ ...l, ...computeLine(l, intraState) }));
  const totals: DocTotals = { subtotalPaise: 0n, discountPaise: 0n, taxablePaise: 0n, cgstPaise: 0n, sgstPaise: 0n, igstPaise: 0n, totalPaise: 0n };
  for (const c of computed) {
    totals.subtotalPaise += c.taxablePaise + BigInt(c.discountPaise ?? 0);
    totals.discountPaise += BigInt(c.discountPaise ?? 0);
    totals.taxablePaise += c.taxablePaise;
    totals.cgstPaise += c.cgstPaise;
    totals.sgstPaise += c.sgstPaise;
    totals.igstPaise += c.igstPaise;
    totals.totalPaise += c.totalPaise;
  }
  return { lines: computed, totals };
}

/** Indian financial-year label for a date, e.g. 2026-10-22 with April start → "26-27". */
export function financialYear(date: Date, startMonth = 4): string {
  const ist = new Date(date.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() + 1 >= startMonth ? y : y - 1;
  if (startMonth === 1) return String(startYear);
  return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

/** Today's date (YYYY-MM-DD) in India time. */
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Parse YYYY-MM-DD as a date-only value (stored in @db.Date columns). */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);
