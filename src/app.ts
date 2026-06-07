import express from 'express';
import cors from 'cors';
import path from 'path';
import { traceMiddleware } from './middlewares/trace.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { globalLimiter } from './middlewares/rateLimiter.middleware';
import authRoutes from './routes/auth.routes';
import meetingRoutes from './routes/meeting.routes';
import actionItemRoutes from './routes/actionItem.routes';
import { getHealth, getEvaluation } from './controllers/system.controller';
import { setupSwagger } from './utils/swagger';

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for all routes
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Trace ID extraction and context propagation middleware
app.use(traceMiddleware);

// Apply global rate limiting to all requests
app.use(globalLimiter);

// Configure dynamic Swagger API documentation served at /api-docs
setupSwagger(app);

// Public health and evaluation metadata endpoints
app.get('/health', getHealth);
app.get('/api/evaluation', getEvaluation);

// Application API routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/action-items', actionItemRoutes);

// Serve React Frontend Static Files in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.redirect('/api-docs');
  });
}

// Centralized error handling middleware (must be registered last)
app.use(errorMiddleware);

export default app;
