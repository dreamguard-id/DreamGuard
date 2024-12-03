const express = require('express');
const { bucket } = require('../configs/bucket');
const { db } = require('../configs/firebase');
const router = express.Router();

// GET LATEST MODEL URL
router.get('/latest', async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ prefix: 'models/' });

    if (!files.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No models found in the bucket.',
      });
    }

    const modelFiles = files
      .map((file) => file.name)
      .filter((name) => /model_v\d+\.tflite$/.test(name));

    if (!modelFiles.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No valid model files found in the bucket.',
      });
    }

    const latestModel = modelFiles.sort((a, b) => {
      const versionA = parseInt(a.match(/_v(\d+)\.tflite$/)[1], 10);
      const versionB = parseInt(b.match(/_v(\d+)\.tflite$/)[1], 10);
      return versionB - versionA;
    })[0];

    const baseUrl = `https://storage.googleapis.com/${bucket.name}`;
    const modelUrl = `${baseUrl}/${latestModel}`;
    const version = latestModel.match(/_v(\d+)\.tflite$/)[1];
    const fileName = latestModel.replace('models/', '');

    const modelsDataRef = db.collection('models').doc('latest_model');
    const modelsDataDoc = await modelsDataRef.get();
    const modelsData = modelsDataDoc.exists ? modelsDataDoc.data() : null;

    if (!modelsData || modelsData.version !== version) {
      await modelsDataRef.set({
        model_url: modelUrl,
        file_name: fileName,
        version: version,
      });
    }

    res.status(200).json({
      status: 'success',
      message:
        'Latest model URL fetched successfully and can be downloaded from the provided URL.',
      model_url: modelUrl,
      version: version,
    });
  } catch (error) {
    console.error('Error fetching latest model:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch the latest model.',
    });
  }
});

module.exports = router;
