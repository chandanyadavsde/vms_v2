/* models/preLrDetail.js  – full payload */
const mongoose = require('mongoose');

const preLrDetailSchema = new mongoose.Schema(
  {
    internal_id:   { type: String, unique: true },
    name:          String,
    state:         String,
    billing_party: String,
    booking_loc:   String,
    business_type: String,
    consignee:     String,
    consignor:     String,
    content:       String,
    cust_doc_type: String,
    cust_ship_code:String,
    from_location: String,
    plant:         String, // duplicate of from_location for quick filter / index
    location_code: String,
    movement_type: String,
    operation_type:String,
    site:          String,
    status:        String,
    to_location:   String,
    subsidiary:    String,
    bill_party_re: String,

    fetchedAt:     Date,
    rawPayload:    Object               // optional debug store

  },
  { timestamps: true }
);

module.exports = mongoose.model('PreLRDetail', preLrDetailSchema);
