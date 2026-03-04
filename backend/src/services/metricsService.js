const counters = {
  totalRequests: 0,
  byStatus: {},
  byMethod: {},
  byRoute: {},
  latencyBuckets: {
    under100ms: 0,
    under500ms: 0,
    over500ms: 0,
  },
};

const increment = (map, key) => {
  map[key] = (map[key] || 0) + 1;
};

export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    counters.totalRequests += 1;
    increment(counters.byStatus, String(res.statusCode));
    increment(counters.byMethod, req.method);
    increment(counters.byRoute, req.path);

    const durationMs = Date.now() - start;
    if (durationMs < 100) {
      counters.latencyBuckets.under100ms += 1;
    } else if (durationMs < 500) {
      counters.latencyBuckets.under500ms += 1;
    } else {
      counters.latencyBuckets.over500ms += 1;
    }
  });

  next();
};

export const getMetricsSnapshot = () => ({
  ...counters,
  timestamp: new Date().toISOString(),
});
