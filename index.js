require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const axios = require("axios");
const {config,createNetsuiteAuthHeaders}= require("./config/netsuite.config");
const { getPreLrList } = require('./controller/preLrController');
const router = require('./routes/master.routes');
const connectDB = require("./config/db.config")

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

app.use(cors());
app.use(bodyParser.json());

// Custom NetSuite config


// 🔹 GET driver record by ID
app.get('/netsuite/driver', async (req, res) => {
  const url = 'https://8300476-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customrecord_bs_sg_tms_pre_lr_header/23543';

  const headers = createNetsuiteAuthHeaders(
    config.consumerKey,
    config.consumerSecret,
    config.tokenKey,
    config.tokenSecret,
    url,
    'GET',
    config.realm
  );

  try {
    const response = await axios.get(url, { headers });
    res.json(response.data);
  } catch (err) {
    console.error('Error fetching driver:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch driver data');
  }
});

// 🔸 POST create new driver record
app.post('/netsuite/driver', async (req, res) => {
  const url = 'https://8300476-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customrecord_driver_master_ag';

  const headers = createNetsuiteAuthHeaders(
    config.consumerKey,
    config.consumerSecret,
    config.tokenKey,
    config.tokenSecret,
    url,
    'POST',
    config.realm
  );

  headers['Content-Type'] = 'application/json';

  try {
    const response = await axios.post(url, req.body, { headers });
    res.json({
      message: 'Driver record created successfully',
      result: response.data
    });
  } catch (err) {
    console.error('Error posting to NetSuite:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Failed to create driver record',
      error: err.response?.data || err.message
    });
  }
});

// Serve log viewer (optional)
app.get('/realtime-logs', (req, res) => {
  res.sendFile(__dirname + '/log-viewer.html');
});

// Default test route
app.get('/', (req, res) => res.send('VMS is Up and Running ✅'));
app.use("/vms",router)

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  connectDB();
  console.log(`Server running at http://localhost:${PORT}`);
});
