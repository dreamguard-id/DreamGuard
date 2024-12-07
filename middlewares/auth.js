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

    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.display_name,
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
