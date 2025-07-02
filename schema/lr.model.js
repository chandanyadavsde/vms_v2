const mongoose = require('mongoose');
const { Schema } = mongoose;

const lrSchema = new Schema(
  {
    /* parent link (required) */
    prelr:      { type: Schema.Types.ObjectId, ref: 'PreLRDetail', index: true },

    /* LR‑specific fields */
    lrNumber:   { type: String, required: true, trim: true },
    vehicleNo:  { type: String, required: true, trim: true },
    reqDate:    { type: Date,   required: true },   // requisition date
    departDate: { type: Date,   required: true },

    /* meta */
    createdBy:  String
  },
  { timestamps: true }
);

/* no two LRs with the same number under one Pre‑LR */
lrSchema.index({ prelr: 1, lrNumber: 1 }, { unique: true });

module.exports = mongoose.model('LR', lrSchema);
