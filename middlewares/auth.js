const { auth } = require('../configs/firebase');

exports.isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization token is missing or malformed',
      });
    }

    const token = authHeader.split(' ')[1];

    // ! Mock token buat testing, jangan lupa di delete
    if (token === 'mock-token') {
      req.user = {
        uid: 'zglQYzxLWqTGHxJlenc6v4IOp6O2',
        email: 'lemillionscribe@gmail.com',
        name: 'Lemillion',
      };
      return next();
    }

    // Ini verifikasi token dari Firebase yang aslinya
    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      /**
       * Kalo butuh data lain kaya di bawah ini, bisa diambil dari decodedToken :)
       */
      // email: decodedToken.email || null,
      // emailVerified: decodedToken.email_verified || false,
      // name: decodedToken.name || null, //
    };
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);

    const errorMessage =
      error.code === 'auth/id-token-expired'
        ? 'Token has expired'
        : 'Invalid or expired token';

    res.status(403).json({
      status: 'error',
      message: errorMessage,
    });
  }
};
