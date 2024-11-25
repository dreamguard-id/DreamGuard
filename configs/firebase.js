const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const auth = getAuth();
const db = getFirestore();

module.exports = { auth, db };
