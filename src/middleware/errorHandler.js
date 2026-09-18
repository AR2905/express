export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (err.name === 'CastError') {
    statusCode = 404;
    err.message = 'Invalid resource id';
  }
  if (err.code === 11000) {
    statusCode = 400;
    err.message = 'Duplicate value for unique field';
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};