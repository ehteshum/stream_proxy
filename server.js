const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { PassThrough } = require('stream');
const config = require('./config');

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
const MANIFEST_CACHE_TIME = config.nodeEnv === 'production' ? 500 : 1000;

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
                console.log('Serving cached manifest');
                res.set('Content-Type', 'application/vnd.apple.mpegurl');
                return res.send(cachedManifest.content);
            }

            // Fetch new manifest
            console.log('Fetching manifest from:', targetUrl);
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
            console.log('Fetching segment:', targetUrl);
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
        console.error('Streaming error:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(502).send('Error fetching stream content');
        }
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        environment: config.nodeEnv,
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (!res.headersSent) {
        res.status(500).send('Server error');
    }
});

// Start server
const port = process.env.PORT || config.port;
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running in ${config.nodeEnv} mode at http://localhost:${port}`);
});
