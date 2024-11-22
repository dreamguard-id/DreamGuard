const express = require('express');
const path = require('path');
const { DateTime } = require('luxon');
const { db, admin } = require('../configs/firebase');
const { bucket } = require('../configs/bucket');
const { isAuthenticated } = require('../middlewares/auth');
const { uploadMiddleware } = require('../middlewares/upload');
const { body, validationResult } = require('express-validator');


const router = express.Router();

// USER DATA REGISTRATION
/**
 * * Already tested (Working)
 */
router.post('/registration', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const fullname = req.user.name;

    const userData = {
      uid,
      email,
      fullname,
      age: null,
      gender: null,
      profilePicture: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(uid).set(userData);

    const responseData = {
      ...userData,
      age: userData.age === null ? 'null (to be filled)' : userData.age,
      gender:
        userData.gender === null ? 'null (to be filled)' : userData.gender,
      profilePicture:
        userData.profilePicture === null
          ? 'null (to be filled)'
          : userData.profilePicture,
      createdAt: DateTime.now().setZone('Asia/Jakarta').toISO(),
    };

    res.status(201).json({
      status: 'success',
      message:
        'User data has been successfully added to the Firestore database.',
      data: responseData,
    });
  } catch (error) {
    console.error('Error registering user data:', error);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        status: 'error',
        message: 'User not found, please register first.',
      });
    }

    res.status(500).json({
      status: 'error',
      message:
        error.message || 'An unknown error occurred during registration.',
    });
  }
});

// USER ACCOUNT DELETION
/**
 * ! Not tested yet
 * * Most likely working
 * TODO: Test it later
 */
router.delete('/delete-account', isAuthenticated, async (req, res) => {
  const uid = req.user.uid;

  try {
    await db.collection('users').doc(uid).delete();

    await auth.deleteUser(uid);

    res.status(200).json({
      status: 'success',
      message: 'Account and related data have been successfully deleted.',
    });
  } catch (error) {
    console.error('Error deleting user account:', error);

    res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while deleting the account.',
    });
  }
});

// GET USER PROFILE DATA
/**
 * ! Not tested yet
 * * Most likely working
 * TODO: Test it later
 */
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userRef = db.collection('users').doc(uid);
    const userData = await userRef.get();

    if (!userData.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const { email, fullname, gender, age, profilePicture } = userData.data();

    res.status(200).json({
      status: 'success',
      data: { email, fullname, gender, age, profilePicture },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve profile data',
    });
  }
});

// UPDATE OR ADD PROFILE DATA
/**
 * ! Not tested yet
 * * File workflow might be problematic and wrong
 * TODO: Test it later
 */
router.patch(
  '/profile',
  isAuthenticated,
  uploadMiddleware,
  [
    body('fullname')
      .optional()
      .isString()
      .notEmpty()
      .withMessage('Full name cannot be empty'),
    body('gender')
      .optional()
      .isString()
      .isIn(['male', 'female'])
      .withMessage('Gender must be either male or female'),
    body('age')
      .optional()
      .isInt({ min: 0, max: 150 })
      .withMessage('Age must be a number between 0 and 150'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { fullname, gender, age } = req.body;

    const uid = req.user.uid;
    const userRef = db.collection('users').doc(uid);

    try {
      if (req.file) {
        const oldData = await userRef.get();
        if (oldData.exists && oldData.data().profilePicture) {
          const oldFileName = oldData.data().profilePicture.split('/').pop();
          await bucket
            .file(oldFileName)
            .delete()
            .catch(() => {
              console.warn('Failed to delete old profile picture.');
            });
        }

        const fileName = `${Date.now()}_${path.basename(
          req.file.originalname
        )}`;
        const file = bucket.file(fileName);

        await new Promise((resolve, reject) => {
          const blobStream = file.createWriteStream({
            resumable: false,
            contentType: req.file.mimetype,
          });

          blobStream.on('finish', async () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            await userRef.update({ profilePicture: publicUrl });
            resolve(publicUrl);
          });

          blobStream.on('error', (err) => reject(err));
          blobStream.end(req.file.buffer);
        });
      }

      const updates = {};
      if (fullname) updates.fullname = fullname;
      if (gender) updates.gender = gender;
      if (age) updates.age = age;

      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
      }

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }
);

// SAVE PREDICTIONS HISTORY
/**
 * ! Not tested yet
 * * Most likely working
 * TODO: Test it later
 */
router.post('/predict-history', isAuthenticated, async (req, res) => {
  const {
    gender,
    age,
    hoursOfSleep,
    occupation,
    activityLevel,
    stressLevel,
    weight,
    height,
    heartRate,
    dailySteps,
    systolic,
    diastolic,
    predictionResult,
  } = req.body;

  try {
    const uid = req.user.uid;
    const userDocRef = db.collection('users').doc(uid);

    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    await userDocRef.update({
      gender: gender || userDoc.data().gender,
      age: age || userDoc.data().age,
    });

    const predictionData = {
      gender,
      age,
      hoursOfSleep,
      occupation,
      activityLevel,
      stressLevel,
      weight,
      height,
      heartRate,
      dailySteps,
      systolic,
      diastolic,
      predictionResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await userDocRef.collection('history').add(predictionData);

    res.status(201).json({
      status: 'success',
      message: 'Prediction history saved and user data updated successfully.',
      data: predictionData,
    });
  } catch (error) {
    console.error('Error saving prediction history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save prediction history.',
    });
  }
});

module.exports = router;
