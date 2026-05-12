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

// Behind Render / other reverse proxies: correct req.protocol and req.ip for absolute URLs (e.g. post images).
app.set('trust proxy', 1);

// CORS configuration with error handling
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// No-op endpoint for Chrome DevTools probe to avoid 404 noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req: express.Request, res: express.Response) => {
  res.status(204).end();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve legacy uploads from bundled repo files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/events', eventRoutes);
app.use('/documents', documentRoutes);
app.use('/backgrounds', backgroundRoutes);
app.use('/music', musicRoutes);

app.get('/', (_req: express.Request, res: express.Response) => {
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
