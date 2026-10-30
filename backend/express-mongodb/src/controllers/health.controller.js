const { pingDatabase } = require('../config/database');

const SERVICE_NAME = 'express-mongodb-api';
const DATABASE_TYPE = 'mongodb';

async function isDatabaseHealthy() {
  try {
    await pingDatabase();
    return true;
  } catch (err) {
    // Log only the error name: driver messages can include host and user names.
    console.warn(`[${new Date().toISOString()}] MongoDB health check failed: ${err.name}`);
    return false;
  }
}

function health(req, res) {
  res.json({ status: 'healthy', service: SERVICE_NAME });
}

async function healthApp(req, res) {
  const dbOk = await isDatabaseHealthy();
  const status = dbOk ? 'healthy' : 'unhealthy';
  res.status(dbOk ? 200 : 503).json({
    status,
    service: SERVICE_NAME,
    database: { status, type: DATABASE_TYPE },
  });
}

async function healthDb(req, res) {
  if (await isDatabaseHealthy()) {
    return res.json({
      status: 'healthy',
      database: DATABASE_TYPE,
      message: 'Database connection successful',
    });
  }
  return res.status(503).json({
    status: 'unhealthy',
    database: DATABASE_TYPE,
    message: 'Database connection failed',
  });
}

module.exports = { health, healthApp, healthDb };
