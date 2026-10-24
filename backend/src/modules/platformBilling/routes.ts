import { Router, type Request } from 'express';
import { z } from 'zod';
import { isDev } from '../../config/env';
import { db, withPlatform } from '../../kernel/db';
import { notFound } from '../../kernel/errors';
import { validate } from '../../middleware/request';
import { publicRoute, requirePermission, tenantAuth } from '../../middleware/auth';
import { publicLimiter } from '../../middleware/rateLimit';
import { handleWebhook, sendPaymentLink } from './online';
import { testWebhook } from './gateway';

// design v2 Step 4b: payment endpoints outside the Console.

const rawBody = (req: Request) => (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

/** Public: gateway webhooks and the development test gateway. */
export const publicPayments = Router();

publicPayments.post('/webhooks/:gateway', publicRoute, async (req, res) => {
  const out = await handleWebhook(String(req.params.gateway), rawBody(req), req.header('x-razorpay-signature') ?? undefined, req.header('x-razorpay-event-id') ?? undefined);
  res.json(out);
});

if (isDev) {
  const LinkParam = z.object({ linkId: z.string().regex(/^plink_test_[a-z0-9]+$/) });

  // The local "payment page" the test gateway's links open
  publicPayments.get('/payments/test/:linkId', publicRoute, publicLimiter, validate(LinkParam, 'params'), async (req, res) => {
    const order = await withPlatform(() => db().platformOrder.findUnique({ where: { paymentLinkId: String(req.params.linkId) } }));
    if (!order) throw notFound('Payment link');
    const tenant = await withPlatform(() => db().tenant.findUnique({ where: { id: order.tenantId }, select: { name: true } }));
    res.json({ clientName: tenant?.name ?? null, amountPaise: Number(order.totalPaise), status: order.status, kind: order.kind });
  });

  // "Pay" on that page: the test gateway sends the same signed webhook Razorpay would
  publicPayments.post('/payments/test/:linkId/pay', publicRoute, publicLimiter, validate(LinkParam, 'params'), async (req, res) => {
    const order = await withPlatform(() => db().platformOrder.findUnique({ where: { paymentLinkId: String(req.params.linkId) } }));
    if (!order) throw notFound('Payment link');
    const hook = testWebhook(String(req.params.linkId), Number(order.totalPaise));
    res.json(await handleWebhook('test', hook.body, hook.signature, hook.eventId));
  });
}

/** Tenant side: the owner sees what is due to AHEAD and can open the payment link. */
export const tenantPayments = Router();

async function openOrder(tenantId: string) {
  return db().platformOrder.findFirst({ where: { tenantId, status: { in: ['awaiting_payment', 'pending_approval'] } }, orderBy: { createdAt: 'desc' } });
}

tenantPayments.get('/billing/pending-order', ...tenantAuth, requirePermission('tenant.billing.view'), async (req, res) => {
  const order = await withPlatform(() => openOrder(req.ctx!.tenantId));
  res.json(
    order && {
      id: order.id, kind: order.kind, status: order.status, cycle: order.cycle, items: order.items,
      taxablePaise: Number(order.taxablePaise), taxPaise: Number(order.cgstPaise + order.sgstPaise + order.igstPaise), totalPaise: Number(order.totalPaise),
      expiresAt: order.expiresAt, paymentLinkUrl: order.paymentLinkUrl,
    },
  );
});

tenantPayments.post('/billing/pending-order/link', ...tenantAuth, requirePermission('tenant.billing.edit'), async (req, res) => {
  const out = await withPlatform(async () => {
    const order = await openOrder(req.ctx!.tenantId);
    if (!order) throw notFound('Unpaid order');
    return sendPaymentLink(order.id);
  });
  res.json({ url: out.url });
});
