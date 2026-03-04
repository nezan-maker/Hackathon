import createDebug from "debug";

const debug = createDebug("app:error-reporter");

export const reportError = async ({ error, context = {} }) => {
  const payload = {
    message: error?.message || "Unknown error",
    stack: error?.stack || null,
    context,
    timestamp: new Date().toISOString(),
  };

  debug(payload);
};
