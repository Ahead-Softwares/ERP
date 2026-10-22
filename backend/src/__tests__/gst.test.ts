import { describe, expect, it } from 'vitest';
import { computeDocument, computeLine, financialYear } from '../kernel/gst';

describe('GST calculation (LLD §7.3)', () => {
  it('splits CGST/SGST equally for intra-state supply', () => {
    const l = computeLine({ quantity: 2, unitPricePaise: 50000, gstRateBp: 1800 }, true);
    expect(l.taxablePaise).toBe(100000n);
    expect(l.cgstPaise).toBe(9000n);
    expect(l.sgstPaise).toBe(9000n);
    expect(l.igstPaise).toBe(0n);
    expect(l.totalPaise).toBe(118000n);
  });

  it('charges IGST for inter-state supply', () => {
    const l = computeLine({ quantity: 1, unitPricePaise: 100000, gstRateBp: 1200 }, false);
    expect(l.igstPaise).toBe(12000n);
    expect(l.cgstPaise + l.sgstPaise).toBe(0n);
  });

  it('rounds half-up per line to the paisa, with fractional quantities and discounts', () => {
    // 1.5 × ₹333.33 = ₹499.995 → 49 999.5 paise → 50 000; minus ₹10 discount → 49 000 taxable
    const l = computeLine({ quantity: 1.5, unitPricePaise: 33333, discountPaise: 1000, gstRateBp: 500 }, true);
    expect(l.taxablePaise).toBe(49000n);
    expect(l.cgstPaise).toBe(1225n); // 49 000 × 2.5%
    expect(l.totalPaise).toBe(49000n + 2450n);
  });

  it('document totals are sums of lines', () => {
    const { totals } = computeDocument(
      [
        { quantity: 1, unitPricePaise: 49900, gstRateBp: 1800 },
        { quantity: 3, unitPricePaise: 1000, discountPaise: 500, gstRateBp: 0 },
      ],
      true,
    );
    expect(totals.subtotalPaise).toBe(49900n + 3000n);
    expect(totals.discountPaise).toBe(500n);
    expect(totals.taxablePaise).toBe(49900n + 2500n);
    expect(totals.cgstPaise).toBe(4491n);
    expect(totals.totalPaise).toBe(totals.taxablePaise + totals.cgstPaise + totals.sgstPaise);
  });

  it('labels Indian financial years from April', () => {
    expect(financialYear(new Date('2026-10-22T06:00:00Z'))).toBe('26-27');
    expect(financialYear(new Date('2027-03-31T17:00:00Z'))).toBe('26-27'); // 31 Mar 22:30 IST
    expect(financialYear(new Date('2027-03-31T19:00:00Z'))).toBe('27-28'); // 1 Apr 00:30 IST
  });
});
