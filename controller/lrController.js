const LR= require("../schema/lr.model")
const PreLRDetail  = require("../schema/preLrDetail.models")

/* POST /api/lr  → create/update LR */
exports.createLR = async (req, res) => {
  try {
    const { prelrName, lrNumber, vehicleNo, reqDate, departDate, createdBy } = req.body;

    if (!prelrName || !lrNumber || !vehicleNo || !reqDate || !departDate)
      return res.status(400).send('Missing required fields');

    /* 1. find the parent header by its *name* */
    const header = await PreLRDetail.findOne({ name: prelrName });
    if (!header) return res.status(404).send('Pre‑LR not found');

    /* 2. upsert LR, linked via ObjectId */
    const lr = await LR.findOneAndUpdate(
      { prelr: header._id, lrNumber },
      { $set: { vehicleNo, reqDate, departDate, createdBy } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    /* 3. (optional) push LR ref into header.lrs array for quick populate */
    await PreLRDetail.updateOne(
      { _id: header._id, lrs: { $ne: lr._id } },
      { $push: { lrs: lr._id } }
    );

    res.status(201).json(lr);
  } catch (e) {
    console.error(e);
    res.status(500).send('LR create/update failed');
  }
};