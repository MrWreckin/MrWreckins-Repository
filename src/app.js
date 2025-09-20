const express = require('express');
const http = require('http');
const { Server } = require('ws');

const app = express();
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() });
});

// Minimal endpoints (so your UI won’t 404)
app.get('/api/trends', (req, res) => res.json([]));
app.get('/api/opportunities', (req, res) => res.json([]));
app.get('/api/streams', (req, res) => res.json([]));
app.get('/api/products', (req, res) => res.json([]));
app.get('/api/customers', (req, res) => res.json([]));
app.post('/api/scan-trends', (req, res) => res.json({ message: 'Trend scanning initiated' }));

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Basic WebSocket server so the frontend can connect without errors
const wss = new Server({ server });
wss.on('connection', (ws) => {
  // Send a minimal live stats snapshot
  ws.send(JSON.stringify({
    type: 'live_stats',
    data: {
      trends: 0,
      opportunities: 0,
      streams: 0,
      customers: 0,
      totalRevenue: 0,
      totalProfit: 0,
      lastUpdate: new Date().toISOString()
    }
  }));
  ws.on('message', () => {});
  ws.on('close', () => {});
});

server.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
