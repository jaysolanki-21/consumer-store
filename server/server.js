import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import counterRoutes from './routes/counterRoutes.js';
import cashfreeRoutes from './routes/cashfreeRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import { socketHandler } from './sockets/socketHandler.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { setIO } from './sockets/ioInstance.js';
import { startMaintenanceScheduler } from './services/maintenanceService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
if (!process.env.GROQ_API_KEY && !process.env.VITE_GROQ_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '../client/.env'), override: false });
}

const app = express();
const httpServer = createServer(app);

// Dynamic CORS configuration supporting Netlify, Render, local development & custom domains
const corsOriginDelegate = (origin, callback) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server webhooks)
  if (!origin) return callback(null, true);

  const cleanOrigin = origin.replace(/\/+$/, '');
  const configuredOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
  ].filter(Boolean).map((u) => u.replace(/\/+$/, ''));

  if (
    configuredOrigins.includes(cleanOrigin) ||
    cleanOrigin.endsWith('.netlify.app') ||
    cleanOrigin.endsWith('.onrender.com') ||
    cleanOrigin.startsWith('http://localhost:') ||
    cleanOrigin.startsWith('http://127.0.0.1:')
  ) {
    return callback(null, cleanOrigin);
  }

  // Fallback permissive for deployment flexibility while supporting credentials
  return callback(null, cleanOrigin);
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  },
  transports: ['websocket', 'polling'],
});

app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);

// ── Raw body capture for Cashfree webhook HMAC verification ──────────────────
// Registered BEFORE express.json() — only applies to the webhook route.
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = req.body.toString('utf8');
  next();
});

app.use(express.json());

app.set('io', io);

// Register IO singleton so the webhook handler can emit Socket.IO events
setIO(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/payments/cashfree', cashfreeRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/backup', backupRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();

    socketHandler(io);

    // Start background scheduled maintenance evaluator once DB is connected
    startMaintenanceScheduler(io);

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
};

startServer();
