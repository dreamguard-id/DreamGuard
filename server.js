const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user');
const { db } = require('./configs/firebase');
const { bucket } = require('./configs/bucket');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/user', userRoutes);

app.get('/', async (req, res) => {
  try {
    const firestoreTest = await db
      .collection('_healthcheck')
      .doc('status')
      .get();

    const bucketExists = await new Promise((resolve) => {
      bucket.exists((err, exists) => {
        if (err) {
          resolve(false);
        } else {
          resolve(exists);
        }
      });
    });

    const serverTime = new Date().toISOString();
    const version = process.env.VERSION || 'v1';

    res.json({
      status: 'OK',
      message: 'DreamGuard API is ready and all services are connected',
      timestamp: serverTime,
      version,
      services: {
        firestore: {
          connected: true,
          message: 'Firestore connection successful',
        },
        googleCloudStorage: {
          connected: bucketExists,
          message: bucketExists
            ? 'Google Cloud Storage bucket accessible'
            : 'Unable to access Google Cloud Storage bucket',
        },
      },
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'Error',
      message: 'One or more services are unavailable',
      error: error.message,
      services: {
        firestore: {
          connected: false,
          message: 'Firestore connection failed',
        },
        googleCloudStorage: {
          connected: false,
          message: 'Unable to connect to Google Cloud Storage',
        },
      },
    });
  }
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`DreamGuard server running on port:${port}`);
});
