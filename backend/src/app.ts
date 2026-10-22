import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import routes from './routes';
import { requestId } from './middleware/request';
import { errorHandler, notFoundRoute } from './middleware/error';

// Money is bigint paise in the database; serialise as JSON numbers (safe below 2^53 paise)
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Standard middlewares
app.use(helmet());
app.use(cors({ origin: env.APP_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestId);

// Root route
app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to AHEAD ERP API', docs: '/api/v1/health' });
});

// API routes
app.use('/api/v1', routes);

// Error handling middlewares
app.use(notFoundRoute);
app.use(errorHandler);

export default app;
