"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const postRoutes_1 = __importDefault(require("./routes/postRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const backgroundRoutes_1 = __importDefault(require("./routes/backgroundRoutes"));
const musicRoutes_1 = __importDefault(require("./routes/musicRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// CORS configuration with error handling
const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// No-op endpoint for Chrome DevTools probe to avoid 404 noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
    res.status(204).end();
});
// Serve static files from public directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Serve legacy uploads from bundled repo files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes
app.use('/auth', authRoutes_1.default);
app.use('/posts', postRoutes_1.default);
app.use('/events', eventRoutes_1.default);
app.use('/documents', documentRoutes_1.default);
app.use('/backgrounds', backgroundRoutes_1.default);
app.use('/music', musicRoutes_1.default);
app.get('/', (_req, res) => {
    res.json({ message: 'CEIT Admin Portal API is running' });
});
// For Vercel serverless deployment
exports.default = app;
// Local development
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
