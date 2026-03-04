import { randomUUID } from 'node:crypto';

export const requestLogger = (req, res, next) => {
  const requestId = randomUUID();
  const start = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const log = {
      level: 'info',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(log));
  });

  next();
};
