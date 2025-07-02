require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

const config = {
  realm: '8300476_SB1',
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
  tokenKey: process.env.TOKEN_ID,
  tokenSecret: process.env.TOKEN_SECRET,
};
const createNetsuiteAuthHeaders = (consumerKey, consumerSecret, tokenKey, tokenSecret, url, method, realm) => {
  const oauth = OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: 'HMAC-SHA256',
    hash_function(baseString, key) {
      return crypto.createHmac('sha256', key).update(baseString).digest('base64');
    },
  });

  const token = { key: tokenKey, secret: tokenSecret };
  const requestData = { url, method };

  const header = oauth.toHeader(oauth.authorize(requestData, token));
  header.Authorization += `, realm="${realm}"`;

  return header;
};
module.exports={config,createNetsuiteAuthHeaders}