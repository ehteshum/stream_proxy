const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { PassThrough } = require('stream');
const config = require('./config');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

const app = express();

// Create custom axios instance with keep-alive
const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 10000,
    maxRedirects: 5
});

// Enable CORS
app.use(cors(config.cors));

// Serve static files
app.use(express.static('.'));

// Cache for m3u8 manifests
const manifestCache = new Map();
const MANIFEST_CACHE_TIME = config.nodeEnv === 'production' ? 500 : 1000; // Shorter cache time in production

// Stream the response
function streamResponse(response, res) {
    const stream = new PassThrough();
    response.data.pipe(stream);
    stream.pipe(res);
}

// Custom middleware for HLS streaming
app.use('/stream', async (req, res, next) => {
    const targetUrl = `${config.streamUrl}${req.path}`;
    const isM3U8 = req.path.endsWith('.m3u8');
    const isTS = req.path.endsWith('.ts');

    if (!isM3U8 && !isTS) {
        return next();
    }

    // Set common headers
    res.set(config.cors);

    try {
        if (isM3U8) {
            // Check cache for manifest
            const cachedManifest = manifestCache.get(req.path);
            if (cachedManifest && Date.now() - cachedManifest.timestamp < MANIFEST_CACHE_TIME) {
                logger.info('Serving cached manifest');
                res.set('Content-Type', 'application/vnd.apple.mpegurl');
                return res.send(cachedManifest.content);
            }

            // Fetch new manifest
            logger.info('Fetching new manifest');
            const response = await axiosInstance({
                method: 'get',
                url: targetUrl,
                responseType: 'text',
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            // Validate and process manifest
            const manifest = response.data;
            if (!manifest.includes('#EXTM3U')) {
                throw new Error('Invalid M3U8 content');
            }

            // Cache manifest
            manifestCache.set(req.path, {
                content: manifest,
                timestamp: Date.now()
            });

            // Send response
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(manifest);
        } else {
            // Handle TS segment
            logger.info('Fetching segment:', req.path);
            const response = await axiosInstance({
                method: 'get',
                url: targetUrl,
                responseType: 'stream',
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            // Set segment-specific headers
            res.set('Content-Type', 'video/MP2T');
            res.set('Cache-Control', 'public, max-age=0');

            // Stream the response
            streamResponse(response, res);
        }
    } catch (error) {
        logger.error('Streaming error:', error.message);
        if (!res.headersSent) {
            res.status(502).send('Error fetching stream content');
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', environment: config.nodeEnv });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error('Server error:', err);
    if (!res.headersSent) {
        res.status(500).send('Server error');
    }
});

// Start server with error handling
const server = app.listen(config.port, () => {
    logger.info(`Server running in ${config.nodeEnv} mode at http://localhost:${config.port}`);
});

// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    switch (error.code) {
        case 'EACCES':
            logger.error(`Port ${config.port} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(`Port ${config.port} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

// Handle process termination
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Closing server...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});
