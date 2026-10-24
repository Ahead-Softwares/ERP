import { describe, expect, it } from 'vitest';
import * as v from '../contracts/validation';
import { zGstin, zMobileIN, zPhone, zReason } from '../kernel/zodRules';
import { TenantPatch } from '../modules/tenancy/service';

describe('shared field rules (Phase 0 checklist)', () => {
  it('accepts real GSTINs and rejects a wrong check digit', () => {
    expect(v.gstin('27AAPFU0939F1ZV')).toBeNull();
    expect(v.gstin('29AAGCB7383J1Z4')).toBeNull();
    expect(v.gstin('27AAPFU0939F1ZW')).toMatch(/last character/);
    expect(v.gstin('27AAPFU0939F1Z')).toMatch(/15 characters/);
    expect(v.gstin('99AAPFU0939F1ZV')).toMatch(/state code/);
  });

  it('cleans GSTIN input and checks it against the state', () => {
    expect(zGstin.parse(' 27aapfu0939f1zv ')).toBe('27AAPFU0939F1ZV');
    expect(v.gstinStateMismatch('27AAPFU0939F1ZV', '24')).toMatch(/Maharashtra.*Gujarat/);
    expect(v.gstinStateMismatch('27AAPFU0939F1ZV', '27')).toBeNull();
  });

  it('normalises Indian mobiles and keeps international numbers', () => {
    expect(zMobileIN.parse('+91 98765-43210')).toBe('+919876543210');
    expect(zMobileIN.parse('09876543210')).toBe('+919876543210');
    expect(zMobileIN.safeParse('5432109876').success).toBe(false);
    expect(zPhone.parse('+44 20 7946 0958')).toBe('+442079460958');
    expect(zPhone.safeParse('12345').success).toBe(false);
  });

  it('checks PAN holder type against the business type', () => {
    expect(v.pan('abcde1234f')).toBeNull();
    expect(v.panTypeMismatch('ABCPE1234F', 'proprietor')).toBeNull();
    expect(v.panTypeMismatch('ABCDE1234F', 'proprietor')).toMatch(/4th letter of the PAN is P/);
    expect(v.panTypeMismatch('ABCDE1234F', 'other')).toBeNull();
  });

  it('validates IFSC, PIN, HSN/SAC, UPI and bank accounts', () => {
    expect(v.ifsc('HDFC0001234')).toBeNull();
    expect(v.ifsc('HDFC1001234')).not.toBeNull();
    expect(v.pincode('400053')).toBeNull();
    expect(v.pincode('040053')).not.toBeNull();
    expect(v.hsn('3304')).toBeNull();
    expect(v.hsn('33041')).not.toBeNull();
    expect(v.sac('999721')).toBeNull();
    expect(v.upiId('glowstudio@okhdfc')).toBeNull();
    expect(v.bankAccount('50100212345678')).toBeNull();
    expect(v.bankAccount('1234')).not.toBeNull();
  });

  it('rejects impossible and future dates', () => {
    expect(v.isoDate('2026-02-28')).toBeNull();
    expect(v.isoDate('2026-02-31')).toMatch(/doesn't exist/);
    expect(v.notFutureDate('2999-01-01')).toMatch(/future/);
  });

  it('suggests a fix for common email typos', () => {
    expect(v.emailSuggestion('rohan@gmial.com')).toBe('rohan@gmail.com');
    expect(v.emailSuggestion('rohan@gmail.com')).toBeNull();
    expect(v.emailSuggestion('rohan@glowstudio.in')).toBeNull();
  });

  it('enforces the password and name rules', () => {
    expect(v.password('short1')).toMatch(/8 characters/);
    expect(v.password('lettersonly')).toMatch(/letter and one number/);
    expect(v.password('glowstudio24')).toBeNull();
    expect(v.passwordStrength('Glow$tudio2024')).toBe(4);
    expect(v.personName('Asha Rao')).toBeNull();
    expect(v.personName('Asha123')).toMatch(/letters/);
  });

  it('needs a 10–500 character reason for sensitive changes', () => {
    expect(zReason.safeParse('short').success).toBe(false);
    expect(zReason.safeParse('Moved to a second shop with a new GST registration').success).toBe(true);
  });

  it('business profile patch uses the same rules', () => {
    const bad = TenantPatch.safeParse({ gstin: '27AAPFU0939F1ZW', billingStateCode: '99', address: { pincode: '12' } });
    expect(bad.success).toBe(false);
    const fields = bad.success ? [] : bad.error.issues.map((i) => i.path.join('.'));
    expect(fields).toEqual(expect.arrayContaining(['gstin', 'billingStateCode', 'address.pincode']));
    expect(TenantPatch.parse({ gstin: '' }).gstin).toBeNull();
  });
});
