/* ------------------------------------------------------------------ */
/*  Imports & constants                                               */
/* ------------------------------------------------------------------ */
const axios  = require('axios');
const pLimit = require('p-limit').default;

const { config, createNetsuiteAuthHeaders } = require('../config/netsuite.config');
const PreLRQueue  = require('../schema/preLrHeader.model');    // queue
const PreLRDetail = require('../schema/preLrDetail.models');   // detail

const BASE        = 'https://8300476-sb1.suitetalk.api.netsuite.com/services/rest/record/v1';
const LIST_LIMIT  = 1000;
const limit       = pLimit(4);

/* helper: {id,refName} → refName, otherwise primitive */
const deref = v => (v && typeof v === 'object' && 'refName' in v ? v.refName : v);

/* ------------------------------------------------------------------ */
/*  Mapper function (must be defined BEFORE it’s used)                */
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
  plant:         deref(o.custrecord_bs_sg_pre_lr_hd_from_location),
  location_code: deref(o.custrecord_bs_sg_pre_lr_hd_location_code),
  movement_type: deref(o.custrecord_bs_sg_pre_lr_hd_movement_type),
  operation_type:deref(o.custrecord_bs_sg_pre_lr_hd_opertion_type),
  site:          deref(o.custrecord_bs_sg_pre_lr_hd_site),
  status:        deref(o.custrecord_bs_sg_pre_lr_hd_status),
  to_location:   deref(o.custrecord_bs_sg_pre_lr_hd_to_location),
  subsidiary:    deref(o.custrecord_bs_sg_prelr_head_subsidiary),
  bill_party_re: deref(o.custrecord_bs_sg_prelr_hed_billpartyre)
});

/* ------------------------------------------------------------------ */
/*  NetSuite single‑record fetcher                                    */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Internal helper – sync remaining queue rows                       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Phase ① – harvest IDs; auto‑trigger Phase ② if needed             */
/* ------------------------------------------------------------------ */
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

    if (bulkOps.length) {
  const result = await PreLRQueue.bulkWrite(bulkOps, { ordered: false });
  const newIds = result.upsertedCount;        // 0 if nothing new

  if (newIds > 0) {
    const synced = await syncPreLrDetailInternal();
    return res.json({ imported: newIds, synced,
                      message: 'IDs stored and details synced.' });
  }
}
return res.json({ imported: 0, synced: 0, message: 'No new Pre‑LRs.' });

  } catch (err) {
    console.error('ID‑harvest error:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch / store Pre‑LR IDs');
  }
};

/* ------------------------------------------------------------------ */
/*  Public Phase ② endpoint (manual/cron)                             */
/* ------------------------------------------------------------------ */
exports.syncPreLrDetail = async (req, res) => {
  try {
    const processed = await syncPreLrDetailInternal();
    res.json({ processed, message: 'Detail sync complete.' });
  } catch (err) {
    console.error('Detail‑sync error:', err.response?.data || err.message);
    res.status(500).send('Failed to sync Pre‑LR details');
  }
};

/* ------------------------------------------------------------------ */
/*  Debug: fetch raw NetSuite JSON for a single ID                     */
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
