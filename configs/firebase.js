const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccountKey = require('../serviceaccountkey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

const auth = getAuth();
const db = getFirestore();

module.exports = { auth, db, admin };
