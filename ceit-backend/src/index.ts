import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/authRoutes';
import postRoutes from './routes/postRoutes';
import eventRoutes from './routes/eventRoutes';
import documentRoutes from './routes/documentRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve CEIT Viewer frontend files (supports env override + fallback)
const configuredViewerPath = process.env.CEIT_VIEWER_FRONTEND_PATH
  ? path.resolve(process.env.CEIT_VIEWER_FRONTEND_PATH)
  : '';
const externalViewerPath = path.resolve(__dirname, '../../ceit-viewer/ceit-viewer/frontend');
const localViewerPath = path.join(__dirname, '../ceit-viewer/frontend');
const viewerFrontendPath = configuredViewerPath && fs.existsSync(configuredViewerPath)
  ? configuredViewerPath
  : fs.existsSync(externalViewerPath)
    ? externalViewerPath
    : localViewerPath;
app.use('/ceit-viewer', express.static(viewerFrontendPath));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/events', eventRoutes);
app.use('/documents', documentRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'CEIT Admin Portal API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
