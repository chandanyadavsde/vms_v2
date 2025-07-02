// routes/plant.js
const express = require('express');
const router  = express.Router();
const PreLRDetail = require('../schema/preLrDetail.models');

/* GET /api/plants  →  list of plants + counts */
router.get('/', async (_, res) => {
  try {
    const list = await PreLRDetail.aggregate([
      { $group: { _id: '$plant', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(list);      // [ { _id:'PUN', count:4821 }, … ]
  } catch (e) {
    console.error(e); res.status(500).send('Failed to list plants');
  }
});

/* GET /api/plants/:plant  →  details for one plant  (paginated) */
router.get('/:plant', async (req, res) => {
  const { plant }   = req.params;
  const page        = parseInt(req.query.page  || 1);
  const pageSize    = parseInt(req.query.limit || 500);
  const skip        = (page - 1) * pageSize;

  try {
    const [total, items] = await Promise.all([
      PreLRDetail.countDocuments({ plant }),
      PreLRDetail.find({ plant })
                 .select('-rawPayload')        // drop large blob
                 .skip(skip).limit(pageSize)
                 .lean()
    ]);

    res.json({ plant, total, page, pageSize, items });
  } catch (e) {
    console.error(e); res.status(500).send('Failed to fetch details');
  }
});

module.exports = router;
