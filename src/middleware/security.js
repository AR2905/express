import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xssClean from 'xss-clean';
import hpp from 'hpp';

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  optionsSuccessStatus: 200,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { success: false, message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const security = (app) => {
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(mongoSanitize());
  app.use(xssClean());
  app.use(hpp());
  app.use('/api', apiLimiter);
};

export { authLimiter };