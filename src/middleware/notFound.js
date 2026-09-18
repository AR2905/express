export const notFound = (req, res, next) => {
  console.log("NOT FOUND", req.originalUrl)
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};