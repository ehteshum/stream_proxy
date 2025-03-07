require('dotenv').config();

const CONFIG = {
    port: process.env.PORT || 3000,
    streamUrl: process.env.STREAM_URL || 'http://kst.moonplex.net:8080',
    nodeEnv: process.env.NODE_ENV || 'development',
    streamPath: '/CH2/tracks-v1a1/mono.m3u8',
    cors: {
        origin: '*',
        methods: ['GET', 'HEAD', 'OPTIONS'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Range'],
        exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
    }
};

module.exports = CONFIG;
