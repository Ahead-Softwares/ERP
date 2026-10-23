import { Router } from 'express';
import { consoleAuth, consoleTx, requirePlatformPermission } from '../../middleware/auth';
import { consoleAccess, dashboard } from './service';

// Console API (design v2, R3-lite). Every route: Console token + one platform.* permission.
// Client screens, plans, settings and Console users arrive in Step 3.

const router = Router();
router.use(consoleAuth);

router.get('/me', async (req, res) => {
  res.json(await consoleAccess(req.console!.userId));
});

router.get('/dashboard', requirePlatformPermission('platform.dashboard.view'), consoleTx(async (req, res) => {
  res.json(await dashboard(req.console!));
}));

export default router;
