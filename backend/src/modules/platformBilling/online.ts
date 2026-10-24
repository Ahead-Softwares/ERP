import type { Prisma } from '@prisma/client';
import { db, withPlatform } from '../../kernel/db';
import { AppError, notFound } from '../../kernel/errors';
import { financialYear } from '../../kernel/gst';
import type { ConsoleCtx } from '../../kernel/context';
import { audit } from '../audit/service';
import { sendMessage } from '../notifications/service';
import { transition } from '../subscription/stateMachine';
import { capturePayment } from './service';
import { gateway, webhookGateway } from './gateway';

// design v2 Step 4b: online payment links, the gateway webhook and credit notes.

const rupees = (paise: bigint | number) => `₹${(Number(paise) / 100).toFixed(2)}`;

async function ownerOf(tenantId: string) {
  const tenant = await db().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, ownerUserId: true } });
  const owner = await db().user.findUniqueOrThrow({ where: { id: tenant.ownerUserId }, select: { name: true, email: true, mobile: true } });
  return { tenant, owner };
}

/** Create (or reuse) the payment link for an open order and send it to the client's owner. Platform transaction. */
export async function sendPaymentLink(orderId: string, opts: { resend?: boolean } = {}) {
  const tx = db();
  const order = await tx.platformOrder.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order');
  if (order.status === 'pending_approval') throw new AppError('INVALID_TRANSITION', 'The discount on this order still needs approval.');
  if (order.status !== 'awaiting_payment') throw new AppError('INVALID_TRANSITION', `This order is ${order.status}.`);

  const { tenant, owner } = await ownerOf(order.tenantId);
  let url = order.paymentLinkUrl;
  if (!url) {
    const link = await gateway().createLink({
      orderId: order.id,
      amountPaise: Number(order.totalPaise),
      description: `AHEAD ${order.kind === 'renewal' ? 'renewal' : 'subscription'} for ${tenant.name}`,
      customer: owner,
      expiresAt: order.expiresAt,
    });
    await tx.platformOrder.update({ where: { id: order.id }, data: { paymentLinkId: link.linkId, paymentLinkUrl: link.url, paymentLinkAt: new Date() } });
    url = link.url;
  } else if (!opts.resend) {
    return { url, sent: false };
  }
  for (const channel of ['email', 'sms'] as const) {
    await sendMessage({
      channel,
      to: channel === 'email' ? owner.email : owner.mobile,
      template: 'billing.payment_link',
      subject: `Pay ${rupees(order.totalPaise)} for AHEAD`,
      text: `Hi ${owner.name}, pay ${rupees(order.totalPaise)} for ${tenant.name}'s AHEAD ${order.kind === 'renewal' ? 'renewal' : 'subscription'}: ${url}`,
    });
  }
  await audit({ tenantId: null, action: 'console.payment_link_sent', entity: 'platform_order', entityId: order.id, after: { url } });
  return { url, sent: true };
}

export interface WebhookResult {
  status: 'processed' | 'duplicate' | 'ignored' | 'needs_attention';
  detail?: string;
}

/**
 * Gateway webhook: verify the signature, store the event once (by event id), then turn a paid
 * link into a captured payment. A business problem (unknown link, wrong amount) is stored on
 * the event and answered with 200 so the gateway stops retrying; a crash rolls back and the
 * gateway retries.
 */
export async function handleWebhook(gatewayName: string, rawBody: Buffer | string, signature: string | undefined, headerEventId?: string): Promise<WebhookResult> {
  const gw = webhookGateway(gatewayName);
  if (!gw || !gw.verify(rawBody, signature)) throw new AppError('WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
  const body = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')) as unknown;
  const evt = gw.parse(body, headerEventId);

  return withPlatform(async () => {
    const tx = db();
    // Seen before → nothing to do. Two copies arriving at the same instant: the second insert
    // fails on the unique event id, the request returns 500 and the gateway's retry hits this check.
    if (await tx.webhookEvent.findUnique({ where: { eventId: evt.eventId } })) return { status: 'duplicate' as const };
    await tx.webhookEvent.create({ data: { gateway: gw.name, eventId: evt.eventId, type: evt.type, payload: body as Prisma.InputJsonValue } });
    const done = (status: WebhookResult['status'], detail?: string) =>
      tx.webhookEvent.update({ where: { eventId: evt.eventId }, data: { processedAt: new Date(), error: status === 'needs_attention' ? detail : null } }).then(() => ({ status, detail }));

    if (evt.type !== 'payment_link.paid' || !evt.linkId) return done('ignored');
    const order = await tx.platformOrder.findUnique({ where: { paymentLinkId: evt.linkId } });
    if (!order) return done('needs_attention', `No order for payment link ${evt.linkId}`);
    if (order.status === 'paid') return done('duplicate', 'Order already paid');
    if (BigInt(evt.amountPaise) !== order.totalPaise) return done('needs_attention', `Paid ${evt.amountPaise} paise, order total is ${order.totalPaise}`);
    if (order.status !== 'awaiting_payment') return done('needs_attention', `Paid, but the order is ${order.status} — refund or reopen by hand`);

    await capturePayment(order.id, {
      method: 'razorpay',
      amountPaise: evt.amountPaise,
      reference: evt.paymentId,
      gatewayPaymentId: evt.paymentId,
      receivedAt: new Date(),
      recordedBy: null,
    });
    return done('processed');
  });
}

/** CN/26-27/000001 — AHEAD's credit note series, separate from invoices. */
async function allocateCreditNoteNumber(at: Date) {
  const fy = financialYear(at, 4);
  const tx = db();
  await tx.$executeRaw`INSERT INTO platform_sequences (doc_type, fy, next_no) VALUES ('credit_note', ${fy}, 1) ON CONFLICT DO NOTHING`;
  const rows = await tx.$queryRaw<{ allocated: number }[]>`
    UPDATE platform_sequences SET next_no = next_no + 1 WHERE doc_type = 'credit_note' AND fy = ${fy}
    RETURNING (next_no - 1)::int AS allocated`;
  return { fy, number: `CN/${fy}/${String(rows[0].allocated).padStart(6, '0')}` };
}

/**
 * Full refund of an AHEAD invoice (v1: whole invoice only). Optionally ends the paid period
 * now — the client drops to the Free plan with paid modules read-only. Platform transaction.
 */
export async function issueCreditNote(ctx: ConsoleCtx, invoiceId: string, input: { reason: string; endSubscription: boolean }) {
  const tx = db();
  const invoice = await tx.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw notFound('Invoice');
  if (await tx.platformCreditNote.findUnique({ where: { invoiceId } })) throw new AppError('CONFLICT', 'This invoice already has a credit note.');
  const now = new Date();
  const { fy, number } = await allocateCreditNoteNumber(now);
  const note = await tx.platformCreditNote.create({
    data: {
      number, fy, tenantId: invoice.tenantId, invoiceId, reason: input.reason.trim(),
      taxablePaise: invoice.taxablePaise, cgstPaise: invoice.cgstPaise, sgstPaise: invoice.sgstPaise, igstPaise: invoice.igstPaise, totalPaise: invoice.totalPaise,
      createdBy: ctx.userId, issuedAt: now,
    },
  });
  if (input.endSubscription) {
    const sub = await tx.subscription.findUniqueOrThrow({ where: { tenantId: invoice.tenantId } });
    if (sub.status === 'active') await transition(invoice.tenantId, 'period_end_cancel', { now });
  }
  await audit({ tenantId: null, action: 'console.credit_note_issued', entity: 'platform_invoice', entityId: invoiceId, after: { number, totalPaise: Number(invoice.totalPaise), reason: input.reason.trim(), endSubscription: input.endSubscription } });
  return note;
}
