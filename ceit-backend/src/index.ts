import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import postRoutes from './routes/postRoutes';
import eventRoutes from './routes/eventRoutes';
import documentRoutes from './routes/documentRoutes';
import backgroundRoutes from './routes/backgroundRoutes';
import musicRoutes from './routes/musicRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration with error handling
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Error handling middleware for CORS on failed requests
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next(err);
});

// No-op endpoint for Chrome DevTools probe to avoid 404 noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/events', eventRoutes);
app.use('/documents', documentRoutes);
app.use('/backgrounds', backgroundRoutes);
app.use('/music', musicRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'CEIT Admin Portal API is running' });
});

// For Vercel serverless deployment
export default app;

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
