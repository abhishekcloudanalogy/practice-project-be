const errorHandler = (err, req, res, next) => {
  console.error(err);
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
  }

  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
  }

  if (err.code === 'P2002') {
    statusCode = 409;

    const fields = Array.isArray(err.meta?.target) ? err.meta.target : [];

    if (fields.includes('email')) {
      message = 'Contact email already exists';
    } else if (fields.includes('primaryContact')) {
      message = 'Primary contact already exists';
    } else {
      message = 'Resource already exists';
    }
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message
  });
};

module.exports = errorHandler;
