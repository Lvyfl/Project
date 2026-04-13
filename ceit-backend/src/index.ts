import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import postRoutes from './routes/postRoutes';
import eventRoutes from './routes/eventRoutes';
import documentRoutes from './routes/documentRoutes';
import backgroundRoutes from './routes/backgroundRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// No-op endpoint for Chrome DevTools probe to avoid 404 noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/events', eventRoutes);
app.use('/documents', documentRoutes);
app.use('/backgrounds', backgroundRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'CEIT Admin Portal API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
