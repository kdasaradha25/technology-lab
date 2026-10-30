const mongoose = require('mongoose');

// Fail fast instead of queueing queries while MongoDB is unreachable.
mongoose.set('bufferCommands', false);

const timeoutMs = Number(process.env.MONGO_TIMEOUT_MS || 3000);

function buildMongoUri() {
  const host = process.env.MONGO_HOST || '127.0.0.1';
  const port = process.env.MONGO_PORT || '27017';
  const db = process.env.MONGO_DB || 'technology_lab';
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;
  const authSource = process.env.MONGO_AUTH_SOURCE || 'admin';

  const credentials = user
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password || '')}@`
    : '';
  const query = user ? `?authSource=${encodeURIComponent(authSource)}` : '';
  return `mongodb://${credentials}${host}:${port}/${db}${query}`;
}

let connecting = null;

// Connects once and reuses the connection. Mongoose reconnects by itself after a drop,
// but a failed *initial* connect is not retried, so callers retry by calling this again.
async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = mongoose
      .connect(buildMongoUri(), {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
        socketTimeoutMS: timeoutMs * 2,
      })
      .finally(() => {
        connecting = null;
      });
  }
  await connecting;
}

// Lightweight health check: the MongoDB "ping" command. Never writes data.
async function pingDatabase() {
  await connectDatabase();
  await mongoose.connection.db.admin().command({ ping: 1 });
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, pingDatabase, disconnectDatabase };
