const express = require('express');
const path = require('path');
const { auth, db } = require('../configs/firebase');
const { bucket } = require('../configs/bucket');
const { isAuthenticated } = require('../middlewares/auth');
const { uploadMiddleware } = require('../middlewares/upload');
const { body, validationResult, param } = require('express-validator');
const { DateTime } = require('luxon');
const { predict } = require('../configs/model');
const {
  convertTo24HourFormat,
  calculateDuration,
  calculateDurationDifference,
} = require('../utils/convert');

const router = express.Router();

/**
 * =====================================
 * USER REGISTRATION AND DELETION
 * =====================================
 */

router.post(
  '/register',
  isAuthenticated,
  [
    body('name')
      .optional()
      .isLength({ min: 1 })
      .withMessage('Name cannot be just an empty string')
      .matches(/^[A-Za-z\s]+$/)
      .withMessage('Name must contain only letters and spaces'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email address format'),
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

    let { name, email } = req.body;
    if (!name) name = req.user.name;
    if (!email) email = req.user.email;

    if (!name || !email) {
      return res.status(400).json({
        status: 'error',
        message: `${!name ? 'Name' : 'Email'} is required and cannot be empty`,
      });
    }

    const uid = req.user.uid;

    try {
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

      // Berikan respons sukses
      res.status(201).json({
        status: 'success',
        message: 'User registered successfully to the database.',
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
  }
);

// USER ACCOUNT DELETION
router.delete('/account', isAuthenticated, async (req, res) => {
  const uid = req.user.uid;

  try {
    const userRef = db.collection('users').doc(uid);
    const batch = db.batch();

    const predictionsSnapshot = await userRef.collection('predictions').get();
    if (!predictionsSnapshot.empty) {
      predictionsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    const sleepSchedulesSnapshot = await userRef
      .collection('sleepSchedules')
      .get();
    if (!sleepSchedulesSnapshot.empty) {
      sleepSchedulesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    await batch.commit();

    await userRef.delete();

    await auth.deleteUser(uid);

    res.status(200).json({
      status: 'success',
      message:
        'Account and related data, including predictions and sleep schedules (if any), have been successfully deleted.',
    });
  } catch (error) {
    console.error('Error deleting user account:', error);

    res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred while deleting the account.',
    });
  }
});

/**
 * =====================================
 * USER PROFILE DATA MANAGEMENT
 * =====================================
 */

// GET USER PROFILE DATA
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

    const { email, name, gender, age, occupation, profilePicture } =
      userData.data();

    res.status(200).json({
      status: 'success',
      message: 'User profile retrieved successfully.',
      data: { email, name, gender, age, occupation, profilePicture },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve profile data',
    });
  }
});

// UPDATE USER PROFILE DATA
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
    body('occupation')
      .optional()
      .isString()
      .withMessage('Occupation must be a string'),
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

// ADD NEW FEEDBACK
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

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    const name = userDoc.data().name;

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

/**
 * =====================================
 * USER PREDICTIONS DATA MANAGEMENT
 * =====================================
 */

// ADD NEW PREDICTION
router.post(
  '/predictions',
  isAuthenticated,
  [
    body('gender')
      .isInt({ min: 1, max: 2 })
      .withMessage('Gender must be 1 (Female) or 2 (Male)'),
    body('age').isInt({ min: 1 }).withMessage('Age must be a positive number'),
    body('sleepDuration')
      .isFloat({ min: 0 })
      .withMessage('Hours of sleep must be a non-negative number'),
    body('sleepQuality')
      .isInt({ min: 1, max: 10 })
      .withMessage('Sleep quality must be an integer between 1 and 10'),
    body('occupation')
      .isInt({ min: 1, max: 11 })
      .withMessage('Occupation must be an integer between 1 and 11'),
    body('activityLevel')
      .isInt({ min: 1, max: 100 })
      .withMessage('Activity level must be an integer between 1 and 100'),
    body('stressLevel')
      .isInt({ min: 1, max: 10 })
      .withMessage('Stress level must be an integer between 1 and 10'),
    body('weight').isInt({ min: 1 }).withMessage('Weight must be positive'),
    body('height').isInt({ min: 1 }).withMessage('Height must be positive'),
    body('heartRate')
      .isInt({ min: 1 })
      .withMessage('Heart rate must be a positive integer'),
    body('dailySteps')
      .isInt({ min: 0 })
      .withMessage('Daily steps must be a non-negative integer'),
    body('systolic')
      .isInt({ min: 1 })
      .withMessage('Systolic blood pressure must be a positive integer'),
    body('diastolic')
      .isInt({ min: 1 })
      .withMessage('Diastolic blood pressure must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const {
      gender,
      age,
      sleepDuration,
      sleepQuality,
      occupation,
      activityLevel,
      stressLevel,
      weight,
      height,
      heartRate,
      dailySteps,
      systolic,
      diastolic,
    } = req.body;

    try {
      const uid = req.user.uid;
      const userDocRef = db.collection('users').doc(uid);
      const predictionsRef = userDocRef.collection('predictions');

      const bmi = weight / Math.pow(height / 100, 2);
      const bmiCategory = bmi <= 24.9 ? 1 : bmi <= 29.9 ? 2 : 3;

      const inputData = [
        [
          gender,
          age,
          occupation,
          sleepDuration,
          sleepQuality,
          activityLevel,
          stressLevel,
          bmiCategory,
          heartRate,
          dailySteps,
          systolic,
          diastolic,
        ],
      ];

      const predictionResult = await predict(inputData);
      const { predictedClass, confidencePercentages } = predictionResult;

      let predictionResultId;
      let predictionResultText;

      if (predictedClass === 1) {
        predictionResultText = 'No Sleep Disorder';
        if (sleepDuration < 8 && stressLevel >= 8) {
          predictionResultId = 6;
        } else if (sleepDuration < 8) {
          predictionResultId = 4;
        } else if (stressLevel >= 8) {
          predictionResultId = 5;
        } else {
          predictionResultId = 1;
        }
      } else if (predictedClass === 2) {
        predictionResultText = 'Sleep Apnea';
        predictionResultId = 2;
      } else if (predictedClass === 3) {
        predictionResultText = 'Sleep Insomnia';
        predictionResultId = 3;
      }

      const formattedConfidence = {
        'No Sleep Disorder': `${confidencePercentages[0]}%`,
        'Sleep Apnea': `${confidencePercentages[1]}%`,
        'Sleep Insomnia': `${confidencePercentages[2]}%`,
      };

      const createdAt = DateTime.now()
        .setZone('Asia/Jakarta')
        .toFormat('d MMMM yyyy');

      const predictionData = {
        gender,
        age,
        sleepDuration,
        sleepQuality,
        occupation,
        activityLevel,
        stressLevel,
        weight,
        height,
        heartRate,
        dailySteps,
        systolic,
        diastolic,
        bmiCategory,
        prediction: {
          id: predictionResultId,
          result: predictionResultText,
          confidencePercentage: formattedConfidence,
        },
        createdAt,
      };

      const snapshot = await predictionsRef.get();
      const predictionNumber = snapshot.size + 1;
      predictionData.predictionNumber = predictionNumber;

      await predictionsRef.add(predictionData);

      res.status(201).json({
        status: 'success',
        message: 'Prediction generated and saved successfully.',
        data: predictionData,
      });
    } catch (error) {
      console.error('Error generating prediction:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate and save prediction.',
      });
    }
  }
);

// GET ALL PREDICTIONS
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
      .orderBy('predictionNumber', 'desc')
      .get();

    if (predictionsSnapshot.empty) {
      return res.status(404).json({
        status: 'error',
        message: 'No prediction history found.',
      });
    }

    const predictions = predictionsSnapshot.docs.map((doc) => {
      const predictionData = doc.data();
      const prediction = predictionData.prediction || {};

      return {
        predictionResultId: prediction.id,
        predictionResultText: prediction.result,
        createdAt: predictionData.createdAt,
      };
    });

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

// GET LATEST PREDICTION
router.get('/predictions/latest', isAuthenticated, async (req, res) => {
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

    const predictionsRef = userDocRef.collection('predictions');

    const latestPredictionSnapshot = await predictionsRef
      .orderBy('predictionNumber', 'desc')
      .limit(1)
      .get();

    if (latestPredictionSnapshot.empty) {
      return res.status(404).json({
        status: 'error',
        message: 'No predictions found.',
      });
    }

    const latestPrediction = latestPredictionSnapshot.docs[0].data();

    const predictionData = {
      gender: latestPrediction.gender,
      age: latestPrediction.age,
      sleepDuration: latestPrediction.sleepDuration,
      sleepQuality: latestPrediction.sleepQuality,
      occupation: latestPrediction.occupation,
      activityLevel: latestPrediction.activityLevel,
      stressLevel: latestPrediction.stressLevel,
      weight: latestPrediction.weight,
      height: latestPrediction.height,
      heartRate: latestPrediction.heartRate,
      dailySteps: latestPrediction.dailySteps,
      systolic: latestPrediction.systolic,
      diastolic: latestPrediction.diastolic,
    };

    res.status(200).json({
      status: 'success',
      message: 'Latest prediction retrieved successfully.',
      data: predictionData,
    });
  } catch (error) {
    console.error('Error retrieving latest prediction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve latest prediction.',
    });
  }
});

// FILTER PREDICTIONS BY predictionResult QUERY PARAM
router.get('/predictions/filter', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { predictionResult } = req.query;

    const userDocRef = db.collection('users').doc(uid);

    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    let predictionsQuery = userDocRef.collection('predictions');

    if (predictionResult) {
      predictionsQuery = predictionsQuery.where(
        'prediction.result',
        '==',
        predictionResult
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
      predictionResultId: doc.data().prediction.id,
      predictionResultText: doc.data().prediction.result,
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

/**
 * =====================================
 * USER SLEEP SCHEDULES DATA MANAGEMENT
 * =====================================
 */

// ADD NEW SLEEP SCHEDULE
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
      const newScheduleDoc = await schedulesRef.add(scheduleData);

      await newScheduleDoc.update({ id: newScheduleDoc.id });
      scheduleData.id = newScheduleDoc.id;

      res.status(201).json({
        status: 'success',
        message: 'Sleep schedule created successfully',
        data: scheduleData,
      });
    } catch (error) {
      console.error('Error creating sleep schedule:', error);
      res
        .status(500)
        .json({ status: 'error', message: 'Failed to create sleep schedule' });
    }
  }
);

// GET ALL SLEEP SCHEDULE
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

// UPDATE SLEEP SCHEDULE
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
      const scheduleRef = userDocRef.collection('sleepSchedules').doc(id);

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
        const bedTime24 = convertTo24HourFormat(bedTime);
        const wakeUpTime24 = convertTo24HourFormat(wakeUpTime);
        const plannedDuration = calculateDuration(bedTime24, wakeUpTime24);
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
        const difference = calculateDurationDifference(
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

// ADD OR UPDATE SLEEP GOALS
router.patch(
  '/sleep-goals',
  isAuthenticated,
  [
    body('hours')
      .notEmpty()
      .withMessage('Hours is required')
      .isInt({ min: 0, max: 24 })
      .withMessage('Hours must be an integer between 0 and 24'),

    body('minutes')
      .notEmpty()
      .withMessage('Minutes is required')
      .isInt({ min: 0, max: 59 })
      .withMessage('Minutes must be an integer between 0 and 59'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { hours, minutes } = req.body;

    try {
      const uid = req.user.uid;
      const userDocRef = db.collection('users').doc(uid);

      await userDocRef.update({
        sleepGoal: {
          hours,
          minutes,
        },
      });

      res.status(200).json({
        status: 'success',
        message: 'Sleep goals updated successfully',
        sleepGoal: `${hours}h ${minutes}m`,
      });
    } catch (error) {
      console.error('Error updating sleep goals:', error);
      res
        .status(500)
        .json({ status: 'error', message: 'Failed to update sleep goals' });
    }
  }
);

// GET SLEEP GOALS
router.get('/sleep-goals', isAuthenticated, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res
        .status(404)
        .json({ status: 'error', message: 'User not found' });
    }

    const userData = userDoc.data();
    const sleepGoal = userData.sleepGoal;

    if (!sleepGoal) {
      return res.status(404).json({
        status: 'error',
        message: 'No sleep goals found for this user',
      });
    }

    const { hours, minutes } = sleepGoal;

    res.status(200).json({
      status: 'success',
      message: 'Sleep goals retrieved successfully',
      sleepGoal: `${hours}h ${minutes}m`,
    });
  } catch (error) {
    console.error('Error retrieving sleep goals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve sleep goals',
    });
  }
});

/**
 * =====================================
 * USER HOME PAGE STATISTICS
 * =====================================
 */

// GET HOME PAGE DATA
router.get('/statistics', isAuthenticated, async (req, res) => {
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

    const userData = userDoc.data();

    // Fetch predictions subcollection
    const predictionsRef = userDocRef.collection('predictions');
    const predictionsSnapshot = await predictionsRef.get();
    const predictions = predictionsSnapshot.docs.map((doc) => doc.data());

    // Fetch sleepSchedules subcollection
    const sleepSchedulesRef = userDocRef.collection('sleepSchedules');
    const sleepSchedulesSnapshot = await sleepSchedulesRef.get();
    const sleepSchedules = sleepSchedulesSnapshot.docs.map((doc) => doc.data());

    // 1. Last prediction card
    const lastPrediction = predictions.reduce((max, current) => {
      return current.predictionNumber > (max?.predictionNumber || 0)
        ? current
        : max;
    }, null);

    const lastPredictionCard = lastPrediction
      ? {
          predictionResultText: lastPrediction.prediction.result,
          predictionResultId: lastPrediction.prediction.id,
          createdAt: lastPrediction.createdAt,
        }
      : null;

    // 2. Average sleep time card
    const validSleepSchedules = sleepSchedules.filter(
      (schedule) => schedule.actualDuration
    );

    const totalSleepTime = validSleepSchedules.reduce((acc, schedule) => {
      const [hours, minutes] = schedule.actualDuration
        .split(' ')
        .map((part) => parseInt(part.replace(/[hm]/g, ''), 10));

      return acc + hours * 60 + minutes;
    }, 0);

    const avgSleepTime = validSleepSchedules.length
      ? totalSleepTime / validSleepSchedules.length
      : 0;
    const avgHours = Math.floor(avgSleepTime / 60);
    const avgMinutes = Math.round(avgSleepTime % 60);

    const sleepGoal = userData.sleepGoal || { hours: 0, minutes: 0 };
    const sleepGoalInMinutes = sleepGoal.hours * 60 + sleepGoal.minutes;
    const sleepTimeDiff = avgSleepTime - sleepGoalInMinutes;

    const avgSleepTimeCard = {
      avgSleepTime: `${avgHours}h ${avgMinutes}m`,
      sleepGoal: `${sleepGoal.hours}h ${sleepGoal.minutes}m`,
      difference: `${Math.abs(Math.floor(sleepTimeDiff / 60))}h ${Math.abs(
        Math.round(sleepTimeDiff % 60)
      )}m`,
    };

    // 3. Average stress level card
    const validStressPredictions = predictions.filter(
      (prediction) =>
        prediction.stressLevel !== null && prediction.stressLevel !== undefined
    );

    const totalStressLevel = validStressPredictions.reduce(
      (acc, prediction) => acc + prediction.stressLevel,
      0
    );
    const avgStressLevel = validStressPredictions.length
      ? Math.round(totalStressLevel / validStressPredictions.length)
      : 0;

    const stressExpressions = [
      'Very Calm – Completely relaxed, no noticeable stress.',
      'Calm – Minor concerns but feeling in control.',
      'Slightly Stressed – Occasional stress that doesn’t interfere with activities.',
      'Mild Stress – Some noticeable tension, but manageable.',
      'Moderate Stress – Balanced between tension and calmness.',
      'Noticeable Stress – Feeling pressure, needing to take breaks to relax.',
      'High Stress – Frequent stress impacting focus and daily activities.',
      'Very High Stress – Significant pressure, struggling to manage effectively.',
      'Extreme Stress – Overwhelmed, needing intervention to cope.',
      'Severe Stress – Constant, unmanageable stress affecting well-being.',
    ];

    const avgStressLevelCard = {
      avgStressLevel,
      expression: stressExpressions[avgStressLevel - 1] || 'N/A',
    };

    // 4. Average activity level card
    const validActivityPredictions = predictions.filter(
      (prediction) =>
        prediction.activityLevel !== null &&
        prediction.activityLevel !== undefined
    );

    const totalActivityLevel = validActivityPredictions.reduce(
      (acc, prediction) => acc + prediction.activityLevel,
      0
    );
    const avgActivityLevel = validActivityPredictions.length
      ? Math.round(totalActivityLevel / validActivityPredictions.length)
      : 0;

    const activityExpressions = [
      'Sedentary – Barely moving, sitting or lying down most of the day.',
      'Very Low – Minimal movement, such as short walks occasionally.',
      'Low – Light activity, standing or walking for short periods.',
      'Slightly Active – Some moderate movement like light chores or brief exercise.',
      'Moderate – Engaging in daily activities, like walking or light workouts.',
      'Fairly Active – Regular moderate exercise or frequent movement.',
      'Active – Daily exercise or an active job requiring consistent physical effort.',
      'Very Active – Rigorous exercise or a highly physical lifestyle.',
      'Extremely Active – Multiple hours of intense physical activity daily.',
      'Hyperactive – Constantly on the move with very high energy expenditure.',
    ];

    const activityLevelIndex = Math.floor((avgActivityLevel - 1) / 10);
    const avgActivityLevelCard = {
      avgActivityLevel,
      expression: activityExpressions[activityLevelIndex] || 'N/A',
    };

    // 5. Average sleep quality card
    const validSleepQualitySchedules = sleepSchedules.filter(
      (schedule) =>
        schedule.sleepQuality !== null && schedule.sleepQuality !== undefined
    );

    const totalSleepQuality = validSleepQualitySchedules.reduce(
      (acc, schedule) => acc + schedule.sleepQuality,
      0
    );

    const avgSleepQuality = validSleepQualitySchedules.length
      ? Math.round(totalSleepQuality / validSleepQualitySchedules.length)
      : 0;

    const sleepQualityExpressions = [
      'Very poor – Hardly any rest, felt like I didn’t sleep at all.',
      'Poor – Tossed and turned all night, felt unrested.',
      'Below average – Managed some sleep, but it wasn’t refreshing.',
      'Fair – Got some sleep, but still felt tired.',
      'Average – Slept okay, but could’ve been better.',
      'Decent – Slept alright, but woke up a little groggy.',
      'Good – Rested well, but not perfect.',
      'Very good – Felt rested and energized.',
      'Great – Slept deeply and woke up refreshed.',
      'Outstanding – Best sleep ever! Completely rejuvenated.',
    ];

    const avgSleepQualityCard = {
      avgSleepQuality,
      expression: sleepQualityExpressions[avgSleepQuality - 1] || 'N/A',
    };

    res.json({
      status: 'success',
      message: 'Homepage data retrieved successfully.',
      data: {
        profilePicture: userData.profilePicture || null,
        name: userData.name,
        todaysDate: DateTime.now()
          .setZone('Asia/Jakarta')
          .toFormat('d MMMM yyyy'),
        lastPredictionCard,
        avgSleepTimeCard,
        avgStressLevelCard,
        avgActivityLevelCard,
        avgSleepQualityCard,
      },
    });
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch homepage data.',
    });
  }
});

module.exports = router;
