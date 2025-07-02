/* models/preLrHeader.js  – queue */
const mongoose = require('mongoose');
module.exports = mongoose.model(
  'PreLRHeader',
  new mongoose.Schema(
    {
      internal_id:   { type: String, unique: true },
      detailsFetched:{ type: Boolean, default: false },
      detailRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'PreLRDetail' },
      fetchedAt:     Date
    },
    { timestamps: true }
  )
);
