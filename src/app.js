// src/app.js
const express = require('express');

process.on('unhandledRejection', (r)=>console.error('unhandledRejection:', r));
process.on('uncaughtException', (e)=>console.error('uncaughtException:', e));

const app = express();

// CORS for cross-domain frontend
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

// Minimal data endpoints
app.get('/api/trends', (req, res) => res.json([]));
app.get('/api/opportunities', (req, res) => res.json([]));
app.get('/api/streams', (req, res) => res.json([]));
app.get('/api/products', (req, res) => res.json([]));
app.get('/api/customers', (req, res) => res.json([]));

// Scan Trends
app.options('/api/scan-trends', (req, res) => res.sendStatus(200)); // preflight
app.post('/api/scan-trends', (req, res) => {
  res.json({ message: 'Trend scanning initiated' });
});
app.get('/api/scan-trends', (req, res) => {
  res.json({ message: 'Scan Trends is POST for the app; GET 200 for browser check' });
});

// Bind explicitly for Render
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend running at http://0.0.0.0:${port}`);
});
