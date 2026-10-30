// node --test runs each file in its own process, so this file can point the app at a
// MongoDB address where nothing is listening without affecting the other tests.
process.env.MONGO_HOST = '127.0.0.1';
process.env.MONGO_PORT = '1';
process.env.MONGO_TIMEOUT_MS = '1000';
require('dotenv').config();

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { disconnectDatabase } = require('../src/config/database');

after(disconnectDatabase);

test('GET /health stays healthy when MongoDB is unavailable', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'healthy');
});

test('GET /health/db returns 503 when MongoDB is unavailable', async () => {
  const res = await request(app).get('/health/db');
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, {
    status: 'unhealthy',
    database: 'mongodb',
    message: 'Database connection failed',
  });
});

test('GET /health/app returns 503 when MongoDB is unavailable', async () => {
  const res = await request(app).get('/health/app');
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, {
    status: 'unhealthy',
    service: 'express-mongodb-api',
    database: { status: 'unhealthy', type: 'mongodb' },
  });
});
