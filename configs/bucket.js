const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const keyFilename = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);

const storage = new Storage({
  keyFilename: keyFilename,
});

const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
const bucket = storage.bucket(bucketName);

module.exports = { bucket };
