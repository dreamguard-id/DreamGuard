const admin = require('firebase-admin');
const path = require('path');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

const serviceAccountKey = require(path.resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

const auth = getAuth();
const db = getFirestore();

module.exports = { auth, db, admin };
