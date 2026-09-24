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
import { socketHandler } from './sockets/socketHandler.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { setIO } from './sockets/ioInstance.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// ── Raw body capture for Cashfree webhook HMAC verification ──────────────────
// Registered BEFORE express.json() — only applies to the webhook route.
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = req.body.toString('utf8');
  next();
});

app.use(express.json());

app.set('io', io);

// Register IO singleton so the webhook handler can emit Socket.IO events
// without needing req.app (webhooks arrive without going through app middleware)
setIO(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/payments/cashfree', cashfreeRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use(errorHandler);

socketHandler(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));