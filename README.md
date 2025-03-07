# HLS Stream Proxy Server

A Node.js-based proxy server for HLS stream playback with CORS support and efficient caching.

## Features

- HLS stream proxy with CORS support
- Manifest caching for better performance
- Efficient segment streaming
- Production-ready error handling
- Health check endpoint
- Environment variable configuration

## Prerequisites

- Node.js >= 14.0.0
- npm or yarn

## Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd stream-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Deployment

### Option 1: Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

2. Login to Heroku:
   ```bash
   heroku login
   ```

3. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

4. Set environment variables:
   ```bash
   heroku config:set STREAM_URL=your_stream_url
   heroku config:set NODE_ENV=production
   ```

5. Deploy:
   ```bash
   git push heroku main
   ```

### Option 2: DigitalOcean App Platform

1. Fork this repository to your GitHub account

2. In DigitalOcean:
   - Go to Apps -> Create App
   - Select your GitHub repository
   - Choose the branch to deploy
   - Configure environment variables:
     - `STREAM_URL`
     - `NODE_ENV=production`
   - Deploy the app

### Option 3: Railway

1. Fork this repository to your GitHub account

2. Visit [Railway](https://railway.app/)

3. Create a new project from GitHub

4. Select your forked repository

5. Add environment variables:
   - `STREAM_URL`
   - `NODE_ENV=production`

6. Deploy

## Environment Variables

- `PORT`: Server port (default: 3000)
- `STREAM_URL`: HLS stream source URL
- `NODE_ENV`: Environment mode (development/production)

## Health Check

The server provides a health check endpoint at `/health` that returns:
```json
{
  "status": "ok",
  "environment": "production"
}
```

## Production Considerations

1. SSL/TLS:
   - Use HTTPS in production
   - Set up SSL certificates
   - Configure secure headers

2. Monitoring:
   - Use logging service (e.g., Papertrail)
   - Set up monitoring (e.g., UptimeRobot)

3. Security:
   - Configure CORS appropriately
   - Set up rate limiting
   - Use security headers

## License

MIT
