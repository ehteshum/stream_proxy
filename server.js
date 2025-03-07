const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { PassThrough } = require('stream');

const app = express();

// Basic configuration
const PORT = process.env.PORT || 3000;
const STREAM_URL = process.env.STREAM_URL || 'http://kst.moonplex.net:8080';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Log startup configuration
console.log('Starting server with config:', {
    port: PORT,
    environment: NODE_ENV,
    streamUrl: STREAM_URL
});

// Create axios instance
const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 10000,
    maxRedirects: 5,
    headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0',
        'Connection': 'keep-alive'
    }
});

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Range', 'User-Agent']
}));

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: {
            port: PORT,
            env: NODE_ENV,
            streamUrl: STREAM_URL
        }
    });
});

// Test stream endpoint
app.get('/test-stream', async (req, res) => {
    const testUrl = `${STREAM_URL}/CH2/tracks-v1a1/mono.m3u8`;
    try {
        console.log('Testing stream URL:', testUrl);
        const response = await axiosInstance.get(testUrl);
        res.json({
            status: 'ok',
            contentType: response.headers['content-type'],
            data: response.data.substring(0, 500), // First 500 chars for safety
            headers: response.headers
        });
    } catch (error) {
        console.error('Test stream error:', {
            url: testUrl,
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                headers: error.response.headers
            } : null
        });
        res.status(502).json({
            status: 'error',
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                headers: error.response.headers
            } : null
        });
    }
});

// Stream proxy endpoint
app.use('/stream', async (req, res) => {
    const targetUrl = `${STREAM_URL}${req.path}`;
    const isM3U8 = req.path.endsWith('.m3u8');
    const isTS = req.path.endsWith('.ts');

    if (!isM3U8 && !isTS) {
        return res.status(400).send('Invalid request');
    }

    try {
        console.log(`Fetching ${isM3U8 ? 'manifest' : 'segment'} from:`, targetUrl);
        
        const response = await axiosInstance({
            method: 'get',
            url: targetUrl,
            responseType: isM3U8 ? 'text' : 'stream',
            timeout: isM3U8 ? 5000 : 10000 // Shorter timeout for manifests
        });

        // Set appropriate headers
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Content-Type': isM3U8 ? 'application/vnd.apple.mpegurl' : 'video/MP2T',
            'Cache-Control': isM3U8 ? 'no-cache' : 'public, max-age=0'
        });

        if (isM3U8) {
            // Log manifest content for debugging
            console.log('Manifest content:', response.data.substring(0, 200));
            
            // Validate M3U8 content
            if (!response.data.includes('#EXTM3U')) {
                throw new Error('Invalid M3U8 content');
            }

            // Send manifest
            res.send(response.data);
        } else {
            // Stream TS segments
            const stream = new PassThrough();
            response.data.pipe(stream);
            stream.pipe(res);

            // Handle stream errors
            stream.on('error', (error) => {
                console.error('Stream error:', error);
                if (!res.headersSent) {
                    res.status(502).send('Streaming error');
                }
            });
        }
    } catch (error) {
        console.error('Proxy error:', {
            url: targetUrl,
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                headers: error.response.headers
            } : null
        });
        
        if (!res.headersSent) {
            res.status(502).send('Error fetching content');
        }
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (!res.headersSent) {
        res.status(500).send('Server error');
    }
});

// Start server
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Test stream: http://localhost:${PORT}/test-stream`);
});
