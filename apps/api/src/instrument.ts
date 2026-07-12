import * as Sentry from '@sentry/node';

/**
 * Error monitoring, off by default. Set SENTRY_DSN to switch it on — without it
 * every Sentry call is a no-op, so this is safe to ship before you have a
 * Sentry project. Imported first in main.ts so instrumentation wraps everything.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    release: process.env.SENTRY_RELEASE,
  });
}

/** True once Sentry has a DSN and is reporting. */
export const sentryEnabled = Boolean(dsn);
