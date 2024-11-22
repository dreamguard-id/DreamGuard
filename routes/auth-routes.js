const express = require('express');
const { auth, db, admin } = require('../config/firebase-config');
const { check, validationResult } = require('express-validator');
const isAuthenticated = require('../middlewares/auth-middleware');
const { DateTime } = require('luxon');

const router = express.Router();

// Registrasi User
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

// // Verifikasi Email
// router.post('/verify-email', async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({
//       status: 'error',
//       message: 'Email is required',
//     });
//   }

//   try {
//     // Ambil user dari Firestore
//     const userQuery = await db
//       .collection('users')
//       .where('email', '==', email)
//       .get();

//     if (userQuery.empty) {
//       return res
//         .status(404)
//         .json({ status: 'error', message: 'User not found' });
//     }

//     const userRef = userQuery.docs[0].ref;

//     // Periksa apakah email sudah diverifikasi di Firebase
//     const userRecord = await auth.getUserByEmail(email);
//     if (!userRecord.emailVerified) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Email not verified yet. Please check your inbox.',
//       });
//     }

//     // Update status verifikasi di Firestore
//     await userRef.update({ isVerified: true });

//     res.status(200).json({
//       status: 'success',
//       message: 'Email successfully verified.',
//     });
//   } catch (error) {
//     console.error('Error verifying email:', error);
//     res.status(500).json({
//       status: 'error',
//       message: error.message || 'An unknown error occurred',
//     });
//   }
// });

// // Resend Verification Link
// router.post('/resend-verification', async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({
//       status: 'error',
//       message: 'Email is required',
//     });
//   }

//   try {
//     // Cek apakah pengguna ada di Firestore
//     const userQuery = await db
//       .collection('users')
//       .where('email', '==', email)
//       .get();

//     if (userQuery.empty) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'User not found',
//       });
//     }

//     // Periksa apakah email sudah diverifikasi di Firebase
//     const userRecord = await auth.getUserByEmail(email);
//     if (userRecord.emailVerified) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Email is already verified.',
//       });
//     }

//     // Kirim ulang email verifikasi
//     const verificationLink = await auth.generateEmailVerificationLink(email);

//     res.status(200).json({
//       status: 'success',
//       message: `Verification email resent to ${email}. Please check your inbox.`,
//       verificationLink, // Optional: for debugging/testing purposes
//     });
//   } catch (error) {
//     console.error('Error resending verification link:', error);
//     res.status(500).json({
//       status: 'error',
//       message: error.message || 'An unknown error occurred',
//     });
//   }
// });

// // Registrasi menggunakan Google
router.post('/register-using-google', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res
      .status(400)
      .json({ status: 'error', message: 'Token is required' });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const userRecord = await auth.getUser(uid);

      await userRef.set({
        uid,
        email: userRecord.email,
        fullname: userRecord.displayName || 'No name',
        profilePicture: userRecord.photoURL || '',
        age: null,
        gender: null,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Login or Registration successful',
      uid,
    });
  } catch (error) {
    console.error('Error registering with Google:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid token or Firebase error',
    });
  }
});

// // Reset Password
// router.post('/reset-password', async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res
//       .status(400)
//       .json({ status: 'error', message: 'Email is required' });
//   }

//   try {
//     // Firebase Client SDK seharusnya digunakan di frontend untuk reset password
//     // Ini hanya placeholder jika admin memutuskan mengirimkan link manual
//     res.status(200).json({
//       status: 'success',
//       message: 'Password reset email has been sent.',
//     });
//   } catch (error) {
//     console.error('Error resetting password:', error);
//     res.status(500).json({
//       status: 'error',
//       message: error.message || 'An unknown error occurred',
//     });
//   }
// });

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validasi input
  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Email and password are required',
    });
  }

  try {
    // Login user menggunakan Firebase Authentication (Admin SDK)
    const user = await auth.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found. Please register first.',
      });
    }

    // Buat token custom untuk pengguna (karena Firebase Admin tidak langsung login user)
    const customToken = await auth.createCustomToken(user.uid);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token: customToken, // Token dikirimkan ke klien
    });
  } catch (error) {
    console.error('Error during login:', error);

    // Tangani kesalahan autentikasi
    res.status(401).json({
      status: 'error',
      message: 'Invalid email or password',
    });
  }
});
// //LOGIN USER
// router.post('/login', async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({
//       status: 'error',
//       message: 'Please provide email and password',
//     });
//   }

//   try {
//     const userRecord = await auth.getUserByEmail(email);
//     const userToken = await auth.createCustomToken(userRecord.uid);
//     res.status(200).json({
//       status: 'success',
//       message: 'Login successful',
//       token: userToken,
//     });
//   } catch (error) {
//     res.status(401).json({
//       status: 'error',
//       message: 'Invalid credentials',
//     });
//   }
// });
// Registrasi User
router.post(
  '/test-registration',
  [
    check('fullname').notEmpty().withMessage('Fullname is required'),
    check('email').isEmail().withMessage('Invalid email format'),
    check('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    check('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { fullname, email, password } = req.body;

    try {
      try {
        await auth.getUserByEmail(email);
        return res.status(409).json({
          status: 'error',
          message: 'User with this email already exists',
        });
      } catch (checkError) {
        if (checkError.code !== 'auth/user-not-found') {
          throw checkError;
        }
      }

      // Create user in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: fullname,
      });

      // Verify user creation
      if (!userRecord || !userRecord.uid) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to create user account',
        });
      }

      res.status(201).json({
        status: 'success',
        message: `User ${email} registered successfully.`,
        userId: userRecord.uid,
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({
        status: 'error',
        message:
          error.code === 'auth/email-already-exists'
            ? 'User with this email already exists'
            : error.message || 'An unknown error occurred during registration',
      });
    }
  }
);

module.exports = router;
