import express from 'express';
import routes from './routes/index.js';
import { security } from './middleware/security.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

security(app);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;