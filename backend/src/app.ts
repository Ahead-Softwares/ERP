import express from 'express';
import cors from 'cors';
import routes from './routes';
import { notFound, errorHandler } from './middlewares/error.middleware';

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to ERP Backend API' });
});

// API routes
app.use('/api', routes);

// Error handling middlewares
app.use(notFound);
app.use(errorHandler);

export default app;
