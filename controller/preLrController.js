/* ------------------------------------------------------------------ */
/*  Imports & constants                                               */
/* ------------------------------------------------------------------ */
const axios  = require('axios');
const pLimit = require('p-limit').default;           // ← add .default for CJS

const { config, createNetsuiteAuthHeaders } = require('../config/netsuite.config');
const PreLRQueue  = require('../schema/preLrHeader.model');   // queue
const PreLRDetail = require('../schema/preLrDetail.models');   // detail

const BASE          = 'https://8300476-sb1.suitetalk.api.netsuite.com/services/rest/record/v1';
const LIST_LIMIT    = 1000;    // NetSuite max per page
const CONCURRENCY   = 4;       // safe throttle
const limit         = pLimit(CONCURRENCY);

/* helper */
const deref = v => (v && typeof v === 'object' && 'refName' in v ? v.refName : v);

/* ------------------------------------------------------------------ */
/*  Phase ① – harvest internal IDs                                    */
/* ------------------------------------------------------------------ */
/* internal helper – returns # of rows processed */
async function syncPreLrDetailInternal () {
  const cursor = PreLRQueue.find({ detailsFetched: { $ne: true } })
                           .lean().batchSize(500);

  let processed = 0;
  const tasks   = [];

  for await (const qDoc of cursor) {
    tasks.push(
      limit(async () => {
        const payload = await fetchOne(qDoc.internal_id);
        const mapped  = mapFields(payload);

        const detail = await PreLRDetail.findOneAndUpdate(
          { internal_id: qDoc.internal_id },
          { $set: { ...mapped, rawPayload: payload, fetchedAt: new Date() } },
          { upsert: true, new: true }
        );

        await PreLRQueue.updateOne(
          { _id: qDoc._id },
          { $set: { detailsFetched: true, fetchedAt: new Date(), detailRef: detail._id } }
        );
        processed++;
      })
    );
  }
  await Promise.all(tasks);
  return processed;
}
/*--------------------------------------------------------------------*/
/*--------------------------------------------------------------------*/
/*--------------------------------------------------------------------*/
exports.getPreLrCount = async (req, res) => {
  try {
    let offset  = 0;
    let hasMore = true;
    const bulkOps = [];

    while (hasMore) {
      const url = `${BASE}/customrecord_bs_sg_tms_pre_lr_header?limit=${LIST_LIMIT}&offset=${offset}`;
      const headers = createNetsuiteAuthHeaders(
        config.consumerKey, config.consumerSecret,
        config.tokenKey,    config.tokenSecret,
        url, 'GET', config.realm
      );

      const { data } = await axios.get(url, { headers });

      data.items.forEach(({ id }) => {
        bulkOps.push({
          updateOne: {
            filter: { internal_id: id },
            update: { $setOnInsert: { internal_id: id } },
            upsert: true
          }
        });
      });

      hasMore = data.hasMore === true;
      offset += LIST_LIMIT;
    }

    if (bulkOps.length) await PreLRQueue.bulkWrite(bulkOps, { ordered: false });

    res.json({ imported: bulkOps.length, message: 'All IDs fetched and stored.' });
  } catch (err) {
    console.error('ID‑harvest error:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch / store Pre‑LR IDs');
  }
};

/* ------------------------------------------------------------------ */
/*  Phase ② – fetch full detail and store                             */
/* ------------------------------------------------------------------ */
const mapFields = o => ({
  state:         deref(o.custrecord_bg_sg_pre_lr_header_state),
  billing_party: deref(o.custrecord_bs_sg_pre_lr_hd_billing_party),
  booking_loc:   deref(o.custrecord_bs_sg_pre_lr_hd_bokng_locatin),
  business_type: deref(o.custrecord_bs_sg_pre_lr_hd_business_type),
  consignee:     deref(o.custrecord_bs_sg_pre_lr_hd_consignee),
  consignor:     deref(o.custrecord_bs_sg_pre_lr_hd_consignor),
  content:       deref(o.custrecord_bs_sg_pre_lr_hd_content),
  cust_doc_type: deref(o.custrecord_bs_sg_pre_lr_hd_cust_r_doc_ty),
  cust_ship_code:deref(o.custrecord_bs_sg_pre_lr_hd_cust_ship_cod),
  from_location: deref(o.custrecord_bs_sg_pre_lr_hd_from_location),
  plant:         deref(o.custrecord_bs_sg_pre_lr_hd_from_location),  // NEW
  location_code: deref(o.custrecord_bs_sg_pre_lr_hd_location_code),
  movement_type: deref(o.custrecord_bs_sg_pre_lr_hd_movement_type),
  operation_type:deref(o.custrecord_bs_sg_pre_lr_hd_opertion_type),
  site:          deref(o.custrecord_bs_sg_pre_lr_hd_site),
  status:        deref(o.custrecord_bs_sg_pre_lr_hd_status),
  to_location:   deref(o.custrecord_bs_sg_pre_lr_hd_to_location),
  subsidiary:    deref(o.custrecord_bs_sg_prelr_head_subsidiary),
  bill_party_re: deref(o.custrecord_bs_sg_prelr_hed_billpartyre)
});

async function fetchOne(id) {
  const url = `${BASE}/customrecord_bs_sg_tms_pre_lr_header/${id}`;
  const headers = createNetsuiteAuthHeaders(
    config.consumerKey, config.consumerSecret,
    config.tokenKey,    config.tokenSecret,
    url, 'GET', config.realm
  );
  const { data } = await axios.get(url, { headers });
  return data;
}

exports.syncPreLrDetail = async (req, res) => {
  try {
    const cursor = PreLRQueue.find({ detailsFetched: { $ne: true } })
                             .lean().batchSize(500);

    let processed = 0;
    const tasks = [];

    for await (const qDoc of cursor) {
      tasks.push(
        limit(async () => {
          const payload = await fetchOne(qDoc.internal_id);
          const mapped  = mapFields(payload);

          /* upsert detail */
          const detail = await PreLRDetail.findOneAndUpdate(
            { internal_id: qDoc.internal_id },
            { $set: { ...mapped, rawPayload: payload, fetchedAt: new Date() } },
            { upsert: true, new: true }
          );

          /* mark queue and link */
          await PreLRQueue.updateOne(
            { _id: qDoc._id },
            { $set: { detailsFetched: true, fetchedAt: new Date(), detailRef: detail._id } }
          );

          processed++;
        })
      );
    }

    await Promise.all(tasks);
    res.json({ processed, message: 'Detail sync complete.' });
  } catch (err) {
    console.error('Detail‑sync error:', err.response?.data || err.message);
    res.status(500).send('Failed to sync Pre‑LR details');
  }
};

/* ------------------------------------------------------------------ */
/*  Optional single‑ID debug fetch                                    */
/* ------------------------------------------------------------------ */
exports.getPreLrList = async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).send('Provide :id in URL');

  try {
    const data = await fetchOne(id);
    res.json(data);
  } catch (err) {
    console.error('Single‑ID fetch error:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch record');
  }
};
