const express = require("express");
const { getPreLrList, getPreLrCount, syncPreLrDetail } = require("../controller/preLrController");

const router = express.Router();
router.get("/preLr/:id",getPreLrList)
router.get("/preLrCount",getPreLrCount)
router.get("/sync-detial",syncPreLrDetail)
// router.get("/preLrDetail",syncPreLrDetail,)

module.exports = router