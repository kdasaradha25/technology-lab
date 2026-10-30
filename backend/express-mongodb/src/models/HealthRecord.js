const mongoose = require('mongoose');

// Each document gets an _id automatically; createdAt is managed by Mongoose.
const healthRecordSchema = new mongoose.Schema(
  {},
  {
    collection: 'health_records',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
