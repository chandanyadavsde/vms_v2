// routes/lr.js
const router = require('express').Router();
const { createLR } = require('../controller/lrController');

router.post('/lr', createLR);
module.exports = router;
