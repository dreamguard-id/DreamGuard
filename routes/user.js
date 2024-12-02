const express = require('express');
const path = require('path');
const { DateTime } = require('luxon');
const { auth, db } = require('../configs/firebase');
const { bucket } = require('../configs/bucket');
const { isAuthenticated } = require('../middlewares/auth');
const { uploadMiddleware } = require('../middlewares/upload');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// USER DATA REGISTRATION
/**
 * * Already tested (Working)
 */
router.post('/register', isAuthenticated, async (req, res) => {
  try {
    const { uid, email, name } = req.user;

    const userData = {
      uid,
      email,
      name,
      age: null,
      gender: null,
      occupation: null,
      sleepGoal: null,
      profilePicture: null,
      createdAt: DateTime.now()
        .setZone('Asia/Jakarta')
        .toFormat("MMMM dd, yyyy 'at' h:mm:ss a 'UTC'Z"),
    };

    await db.collection('users').doc(uid).set(userData);

    const responseData = {
      ...userData,
      age: userData.age === null ? 'null (to be filled)' : userData.age,
      gender:
        userData.gender === null ? 'null (to be filled)' : userData.gender,
      occupation:
        userData.occupation === null
          ? 'null (to be filled)'
          : userData.occupation,
      sleepGoal:
        userData.sleepGoal === null
          ? 'null (to be filled)'
          : userData.sleepGoal,
      profilePicture:
        userData.profilePicture === null
          ? 'null (to be filled)'
          : userData.profilePicture,
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

// GET USER PROFILE DATA
/**
 * * Already tested (Working)
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

    const { email, name, gender, age, profilePicture } = userData.data();

    res.status(200).json({
      status: 'success',
      data: { email, name, gender, age, profilePicture },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve profile data',
    });
  }
});

// UPDATE USER PROFILE DATA
/**
 * * Already tested (Working)
 */
router.patch(
  '/profile',
  isAuthenticated,
  uploadMiddleware,
  [
    body('email')
      .optional()
      .isEmail()
      .notEmpty()
      .withMessage('Invalid email format'),
    body('name')
      .optional()
      .isString()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('age')
      .optional()
      .isInt({ min: 0, max: 150 })
      .withMessage('Age must be a number between 0 and 150'),
    body('gender')
      .optional()
      .isString()
      .isIn(['male', 'female'])
      .withMessage('Gender must be either male or female'),
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

    const { email, name, age, gender, occupation } = req.body;
    const uid = req.user.uid;

    try {
      const updates = {};

      if (email) {
        await auth.updateUser(uid, { email });
        updates.email = email;
      }

      if (name) updates.name = name;
      if (age) updates.age = age;
      if (gender) updates.gender = gender;
      if (occupation) updates.occupation = occupation;

      if (req.file) {
        const userRef = db.collection('users').doc(uid);
        const oldData = await userRef.get();

        if (oldData.exists && oldData.data().profilePicture) {
          const oldFileName = oldData
            .data()
            .profilePicture.split('/profile_pictures/')
            .pop();

          await bucket
            .file(`profile_pictures/${oldFileName}`)
            .delete()
            .catch(() => {
              console.warn('Failed to delete old profile picture.');
            });
        }

        const fileName = `${DateTime.now()
          .setZone('Asia/Jakarta')
          .toFormat('yyyyMMdd_HHmmss')}_${path.basename(uid)}${path.extname(
          req.file.originalname
        )}`;

        const file = bucket.file(`profile_pictures/${fileName}`);

        const publicUrl = await new Promise((resolve, reject) => {
          const blobStream = file.createWriteStream({
            resumable: false,
            contentType: req.file.mimetype,
          });

          blobStream.on('finish', async () => {
            try {
              resolve(
                `https://storage.googleapis.com/${bucket.name}/profile_pictures/${fileName}`
              );
            } catch (err) {
              reject(err);
            }
          });

          blobStream.on('error', (err) => reject(err));
          blobStream.end(req.file.buffer);
        });

        updates.profilePicture = publicUrl;
      }

      if (Object.keys(updates).length > 0) {
        await db.collection('users').doc(uid).update(updates);
      }

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updates,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }
);

// SAVE PREDICTIONS TO HISTORY
/**
 * * Already tested (Working)
 */
function mapPredictionResult(predictionResultId) {
  const resultMapping = {
    0: 'No Sleep Disorder',
    1: 'Sleep Apnea',
    2: 'Sleep Insomnia',
    3: 'No Sleep Disorder', // ID 3 buat kondisi No Sleep Disorder + Tidur < 8 Jam
    4: 'No Sleep Disorder', // ID 4 buat kondisi No Sleep Disorder + Stress Level 8-10
    5: 'No Sleep Disorder', // ID 5 buat kondisi No Sleep Disorder + Tidur < 8 Jam + Stress Level 8-10
  };
  return resultMapping[predictionResultId] || 'Unknown Result';
}

router.post('/predictions', isAuthenticated, async (req, res) => {
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
    predictionResultId,
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

    const predictionResultText = mapPredictionResult(predictionResultId);

    const createdAt = DateTime.now()
      .setZone('Asia/Jakarta')
      .toFormat('d MMMM yyyy');

    const predictionsRef = userDocRef.collection('predictions');
    const snapshot = await predictionsRef.get();
    const predictionNumber = snapshot.size + 1;

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
      predictionResultId,
      predictionResultText,
      predictionNumber,
      createdAt,
    };

    const newPredictionRef = await predictionsRef.add(predictionData);

    res.status(201).json({
      status: 'success',
      message: 'Prediction history saved successfully.',
      data: { id: newPredictionRef.id, ...predictionData },
    });
  } catch (error) {
    console.error('Error saving prediction history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save prediction history.',
    });
  }
});

// GET PREDICTIONS HISTORY
/**
 * * Already tested (Working)
 */
router.get('/predictions', isAuthenticated, async (req, res) => {
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

    const predictionsSnapshot = await userDocRef
      .collection('predictions')
      .orderBy('predictionNumber', 'asc')
      .get();

    if (predictionsSnapshot.empty) {
      return res.status(404).json({
        status: 'error',
        message: 'No prediction history found.',
      });
    }

    const predictions = predictionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      predictionResultId: doc.data().predictionResultId,
      predictionResultText: doc.data().predictionResultText,
      createdAt: doc.data().createdAt,
    }));

    res.status(200).json({
      status: 'success',
      message: 'Prediction history retrieved successfully.',
      data: predictions,
    });
  } catch (error) {
    console.error('Error retrieving prediction history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve prediction history.',
    });
  }
});

// GET PREDICTIONS BY ID
/**
 * * Already tested (Working)
 */
router.get('/predictions/:id', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const predictionId = req.params.id;

    const userDocRef = db.collection('users').doc(uid);

    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    const predictionDocRef = userDocRef
      .collection('predictions')
      .doc(predictionId);
    const predictionDoc = await predictionDocRef.get();

    if (!predictionDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'Prediction not found.',
      });
    }

    const predictionData = predictionDoc.data();

    res.status(200).json({
      status: 'success',
      message: 'Prediction details retrieved successfully.',
      data: {
        id: predictionDoc.id,
        ...predictionData,
      },
    });
  } catch (error) {
    console.error('Error retrieving prediction details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve prediction details.',
    });
  }
});

// FILTER PREDICTIONS BY predictionResultId QUERY PARAMETER
/**
 * * Already tested (Working)
 */
router.get('/predictions/filter', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { predictionResultId } = req.query;

    const userDocRef = db.collection('users').doc(uid);

    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    let predictionsQuery = userDocRef
      .collection('predictions')
      .orderBy('predictionNumber', 'asc');

    if (predictionResultId) {
      predictionsQuery = predictionsQuery.where(
        'predictionResultId',
        '==',
        parseInt(predictionResultId, 10)
      );
    }

    const predictionsSnapshot = await predictionsQuery.get();

    if (predictionsSnapshot.empty) {
      return res.status(404).json({
        status: 'error',
        message: 'No predictions found for the given filter.',
      });
    }

    const predictions = predictionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      predictionResultId: doc.data().predictionResultId,
      predictionResultText: doc.data().predictionResultText,
      createdAt: doc.data().createdAt,
    }));

    res.status(200).json({
      status: 'success',
      message: 'Filtered predictions retrieved successfully.',
      data: predictions,
    });
  } catch (error) {
    console.error('Error retrieving filtered predictions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve filtered predictions.',
    });
  }
});

// ADD NEW FEEDBACK
/**
 * * Already tested (Working)
 */
router.post('/feedback', isAuthenticated, async (req, res) => {
  const { feedback } = req.body;

  if (!feedback) {
    return res.status(400).json({
      status: 'error',
      message: 'Feedback is required.',
    });
  }

  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const name = req.user.name;

    const userFeedbackRef = db.collection('feedbacks').doc(uid);
    const userFeedbackSnapshot = await userFeedbackRef.get();

    if (!userFeedbackSnapshot.exists) {
      await userFeedbackRef.set({ email, name });
    }

    const feedbacksRef = userFeedbackRef.collection('feedbacks');
    const feedbacksSnapshot = await feedbacksRef.get();
    const feedbackNumber = feedbacksSnapshot.size + 1;

    const newFeedback = {
      feedback,
      feedbackNumber,
      createdAt: DateTime.now()
        .setZone('Asia/Jakarta')
        .toFormat("MMMM dd, yyyy 'at' h:mm:ss a 'UTC'Z"),
    };

    await feedbacksRef.add(newFeedback);

    res.status(201).json({
      status: 'success',
      message: 'Feedback successfully added.',
      data: newFeedback,
    });
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add feedback.',
    });
  }
});

// USER ACCOUNT DELETION
/**
 * * Already tested (Working)
 */
router.delete('/account', isAuthenticated, async (req, res) => {
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

// ADD NEW SLEEP SCHEDULE
function convertTo24HourFormat(timeString) {
  return DateTime.fromFormat(timeString, 'hh:mm a').toFormat('HH:mm');
}

function calculateDuration(startTime, endTime) {
  const start = DateTime.fromFormat(startTime, 'hh:mm a');
  const end = DateTime.fromFormat(endTime, 'hh:mm a');

  const duration = end.diff(start, ['hours', 'minutes']);
  const hours = duration.hours;
  const minutes = duration.minutes;

  return `${hours}h ${minutes}m`;
}

router.post(
  '/sleep-schedules',
  isAuthenticated,
  [
    body('bedTime').notEmpty().withMessage('Bedtime is required'),
    body('wakeUpTime').notEmpty().withMessage('Wakeup time is required'),
    body('wakeUpAlarm')
      .isBoolean()
      .withMessage('Wakeup alarm should be a boolean'),
    body('sleepReminders')
      .isBoolean()
      .withMessage('Sleep reminders should be a boolean'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { bedTime, wakeUpTime, wakeUpAlarm, sleepReminders } = req.body;

    try {
      const uid = req.user.uid;
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return res
          .status(404)
          .json({ status: 'error', message: 'User not found' });
      }

      const bedTime24 = convertTo24HourFormat(bedTime);
      const wakeUpTime24 = convertTo24HourFormat(wakeUpTime);

      const scheduleData = {
        bedTime,
        wakeUpTime,
        wakeUpAlarm,
        sleepReminders,
        plannedDuration: calculateDuration(bedTime24, wakeUpTime24),
        actualBedTime: null,
        actualWakeUpTime: null,
        actualDuration: null,
        difference: null,
        sleepQuality: null,
        notes: null,
        createdAt: DateTime.now()
          .setZone('Asia/Jakarta')
          .toFormat('d MMMM yyyy'),
      };

      const schedulesRef = userDocRef.collection('sleepSchedules');
      await schedulesRef.add(scheduleData);

      const newScheduleRef = await schedulesRef.add(scheduleData);
      const id = newScheduleRef.id;
      await newScheduleRef.update({ id }); // Tambahkan ID ke dokumen

      res.status(201).json({
        status: 'success',
        message: 'Sleep schedule created successfully',
        data: { ...scheduleData, id },
      });
    } catch (error) {
      console.error('Error creating sleep schedule:', error);
      res
        .status(500)
        .json({ status: 'error', message: 'Failed to create sleep schedule' });
    }
  }
);

// GET ALL SLEEP SCHEDULES
router.get('/sleep-schedules', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res
        .status(404)
        .json({ status: 'error', message: 'User not found' });
    }

    const schedulesSnapshot = await userDocRef
      .collection('sleepSchedules')
      .get();
    if (schedulesSnapshot.empty) {
      return res
        .status(404)
        .json({ status: 'error', message: 'No sleep schedules found' });
    }

    const schedules = schedulesSnapshot.docs.map((doc) => doc.data());

    res.status(200).json({
      status: 'success',
      message: 'Sleep schedules retrieved successfully',
      data: schedules,
    });
  } catch (error) {
    console.error('Error retrieving sleep schedules:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to retrieve sleep schedules' });
  }
});


// UPDATE SLEEP SCHEDULE BY ID
router.patch(
  '/sleep-schedules/:id',
  isAuthenticated,
  [
    param('id').isString().withMessage('Invalid schedule ID'),
    body('bedTime')
      .optional()
      .isString()
      .withMessage('Invalid bed time format'),
    body('wakeUpTime')
      .optional()
      .isString()
      .withMessage('Invalid wake up time format'),
    body('wakeUpAlarm')
      .optional()
      .isBoolean()
      .withMessage('Wake up alarm should be a boolean'),
    body('sleepReminders')
      .optional()
      .isBoolean()
      .withMessage('Sleep reminders should be a boolean'),
    body('actualBedTime')
      .optional()
      .isString()
      .withMessage('Invalid actual bed time'),
    body('actualWakeUpTime')
      .optional()
      .isString()
      .withMessage('Invalid actual wake up time'),
    body('sleepQuality')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Sleep quality must be between 1 and 10'),
    body('notes').optional().isString().withMessage('Invalid notes format'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { id } = req.params;
    const {
      bedTime,
      wakeUpTime,
      wakeUpAlarm,
      sleepReminders,
      actualBedTime,
      actualWakeUpTime,
      sleepQuality,
      notes,
    } = req.body;

    try {
      const uid = req.user.uid;
      const userDocRef = db.collection('users').doc(uid);
      const scheduleRef = userDocRef
        .collection('sleepSchedules')
        .doc(id);

      const scheduleDoc = await scheduleRef.get();
      if (!scheduleDoc.exists) {
        return res
          .status(404)
          .json({ status: 'error', message: 'Schedule not found' });
      }

      const scheduleData = scheduleDoc.data();
      const updates = {};

      if (bedTime) updates.bedTime = bedTime;
      if (wakeUpTime) updates.wakeUpTime = wakeUpTime;

      if (bedTime || wakeUpTime) {
        const plannedDuration = calculateDuration(bedTime, wakeUpTime);
        updates.plannedDuration = plannedDuration;
      }

      if (wakeUpAlarm !== undefined) updates.wakeUpAlarm = wakeUpAlarm;
      if (sleepReminders !== undefined) updates.sleepReminders = sleepReminders;

      if (actualBedTime && actualWakeUpTime) {
        const actualBedTime24 = convertTo24HourFormat(actualBedTime);
        const actualWakeUpTime24 = convertTo24HourFormat(actualWakeUpTime);

        const actualDuration = calculateDuration(
          actualBedTime24,
          actualWakeUpTime24
        );
        const difference = calculateDuration(
          scheduleData.plannedDuration,
          actualDuration
        );

        updates.actualBedTime = actualBedTime;
        updates.actualWakeUpTime = actualWakeUpTime;
        updates.actualDuration = actualDuration;
        updates.difference = difference;
      }

      if (sleepQuality) updates.sleepQuality = sleepQuality;
      if (notes) updates.notes = notes;

      if (Object.keys(updates).length > 0) {
        await scheduleRef.update(updates);
      }

      res.status(200).json({
        status: 'success',
        message: 'Sleep schedule updated successfully',
        data: updates,
      });
    } catch (error) {
      console.error('Error updating sleep schedule:', error);
      res
        .status(500)
        .json({ status: 'error', message: 'Failed to update sleep schedule' });
    }
  }
);

module.exports = router;
