const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join('config', 'serviceaccountkey.json'),
});

const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
const bucket = storage.bucket(bucketName);

module.exports = { bucket };
