// src/app.js
const express = require('express');
const http = require('http');
const { Server } = require('ws');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();

// CORS so your IONOS site can call the Render API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() });
});

// Minimal endpoints (return empty lists for now)
app.get('/api/trends', (req, res) => res.json([]));
app.get('/api/opportunities', (req, res) => res.json([]));
app.get('/api/streams', (req, res) => res.json([]));
app.get('/api/products', (req, res) => res.json([]));
app.get('/api/customers', (req, res) => res.json([]));

// POST route for Scan Trends (UI triggers this)
app.post('/api/scan-trends', (req, res) => {
  res.json({ message: 'Trend scanning initiated' });
});

app.get('/api/scan-trends', (req, res) => {
  res.json({ message: 'Scan Trends endpoint is POST in the app; returning 200 for browser check' });
});
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Minimal WebSocket so the dashboard shows online and can request live stats
const wss = new Server({ server });

function liveStats() {
  return {
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
  };
}

wss.on('connection', (ws) => {
  try { ws.send(JSON.stringify(liveStats())); } catch (_) {}
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg && msg.type === 'get_live_stats') {
        ws.send(JSON.stringify(liveStats()));
      }
    } catch (_) {
      // ignore non-JSON
    }
  });
});

// Bind to 0.0.0.0 for Render
server.listen(port, '0.0.0.0', () => {
  console.log(`Backend running at http://0.0.0.0:${port}`);
});
