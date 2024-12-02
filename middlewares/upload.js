const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed.')
      );
    }
    cb(null, true);
  },
}).single('profilePicture');

exports.uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'File is too large. Maximum size is 1MB.',
        });
      }
      if (
        err.message ===
        'Invalid file type. Only JPG, JPEG, and PNG are allowed.'
      ) {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        });
      }
      return res.status(500).json({
        status: 'error',
        message: 'An error occurred during file upload.',
      });
    }

    next();
  });
};