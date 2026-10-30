const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://localhost:4200'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins, methods: ['GET'] }));

app.use(healthRoutes);

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

// Centralized error handler. Express 5 forwards rejected promises from async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.path}: ${err.name}`);
  res.status(err.status || 500).json({ status: 'error', message: 'Internal server error' });
});

module.exports = app;
