// models/preLrHeader.js
const mongoose = require('mongoose');
module.exports = mongoose.model('PreLRHeaderInternalId', new mongoose.Schema({
  internal_id: { type: String, unique: true }
}));
