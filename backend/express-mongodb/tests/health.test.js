// Integration tests. They need MongoDB running (docker compose up -d mongo).
require('dotenv').config();

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const HealthRecord = require('../src/models/HealthRecord');

after(disconnectDatabase);

test('GET /health returns healthy', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'healthy', service: 'express-mongodb-api' });
});

test('GET /health/db returns healthy', async () => {
  const res = await request(app).get('/health/db');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    status: 'healthy',
    database: 'mongodb',
    message: 'Database connection successful',
  });
});

test('GET /health/app returns healthy with database status', async () => {
  const res = await request(app).get('/health/app');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    status: 'healthy',
    service: 'express-mongodb-api',
    database: { status: 'healthy', type: 'mongodb' },
  });
});

test('health checks do not insert documents', async () => {
  await connectDatabase();
  const before = await HealthRecord.countDocuments();
  await request(app).get('/health/db');
  await request(app).get('/health/app');
  assert.equal(await HealthRecord.countDocuments(), before);
});

test('HealthRecord can be inserted and retrieved', async () => {
  await connectDatabase();
  const created = await HealthRecord.create({});
  try {
    const fetched = await HealthRecord.findById(created._id).lean();
    assert.ok(fetched, 'record should be retrievable');
    assert.ok(fetched.createdAt instanceof Date);
  } finally {
    await HealthRecord.deleteOne({ _id: created._id });
  }
  assert.equal(await HealthRecord.findById(created._id), null);
});

test('CORS allows configured frontend origins only', async () => {
  const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173');
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');

  const blocked = await request(app).get('/health').set('Origin', 'http://evil.example');
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);
});

test('unknown routes return JSON 404', async () => {
  const res = await request(app).get('/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.status, 'error');
});
