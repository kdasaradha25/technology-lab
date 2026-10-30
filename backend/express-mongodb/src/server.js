require('dotenv').config();

const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const port = Number(process.env.PORT || 8003);

const server = app.listen(port, () => {
  console.log(`[${new Date().toISOString()}] express-mongodb-api listening on port ${port}`);
});

// Connect in the background: the API starts even if MongoDB is not ready yet.
// The health endpoints retry the connection on every request until it succeeds.
connectDatabase()
  .then(() => console.log(`[${new Date().toISOString()}] Connected to MongoDB`))
  .catch((err) => console.warn(`[${new Date().toISOString()}] MongoDB not available at startup: ${err.name}`));

function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] ${signal} received, shutting down`);
  server.close(() => {
    disconnectDatabase().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
