import { z } from "zod";

/**
 * Single source of truth for server-side environment access.
 *
 * Core variables (database, cache, auth/webhook secrets) are required and
 * fail application startup immediately with a clear error if missing or
 * weak — never a hardcoded fallback secret.
 *
 * Every third-party integration is optional at the schema level: if its
 * variables are absent, the integration is reported as `disabled` via
 * `integrationStatus` rather than crashing the app. Routes/services that
 * depend on a given integration must check `integrationStatus.<name>`
 * before use.
 */

const KNOWN_WEAK_SECRETS = new Set([
  "fallback_secret_for_local_development",
  "changeme",
  "secret",
  "password",
]);

const strongSecret = (label: string) =>
  z
    .string()
    .min(32, `${label} must be at least 32 characters long`)
    .refine((v) => !KNOWN_WEAK_SECRETS.has(v.toLowerCase()), {
      message: `${label} is a known placeholder/weak value — set a real random secret`,
    });

const optionalUrl = z.string().url().optional().or(z.literal("").transform(() => undefined));
const optionalNonEmpty = z.string().min(1).optional().or(z.literal("").transform(() => undefined));
const boolFlag = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === "true"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid postgresql:// connection string" }),
  REDIS_URL: z.string().url({ message: "REDIS_URL must be a valid redis:// connection string" }),
  JWT_SECRET: strongSecret("JWT_SECRET"),
  CRON_SECRET: strongSecret("CRON_SECRET"),
  WEBHOOK_SECRET: strongSecret("WEBHOOK_SECRET"),

  // OpenAI
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Google Places
  GOOGLE_PLACES_API_KEY: optionalNonEmpty,

  // DataForSEO — login/password are combined into a Basic auth header at
  // call time (see getDataForSeoAuthHeader). Never store the base64 form.
  DATAFORSEO_LOGIN: optionalNonEmpty,
  DATAFORSEO_PASSWORD: optionalNonEmpty,
  DATAFORSEO_BASE_URL: z.string().url().default("https://api.dataforseo.com"),

  // Apollo
  APOLLO_API_KEY: optionalNonEmpty,

  // Google OAuth / Calendar
  GOOGLE_CLIENT_ID: optionalNonEmpty,
  GOOGLE_CLIENT_SECRET: optionalNonEmpty,
  GOOGLE_REDIRECT_URI: optionalUrl,
  GOOGLE_CALENDAR_ID: z.string().default("primary"),

  // Email
  EMAIL_PROVIDER: z.enum(["gmail"]).default("gmail"),
  GMAIL_USER: optionalNonEmpty,
  GMAIL_APP_PASSWORD: optionalNonEmpty,
  EMAIL_FROM_NAME: z.string().default("Smile AI Marketing"),
  EMAIL_FROM_ADDRESS: optionalNonEmpty,
  EMAIL_REPLY_TO: optionalNonEmpty,
  EMAIL_SEND_MODE: z.enum(["test", "live"]).default("test"),
  EMAIL_TEST_RECIPIENTS: z.string().default("hello@smileaimarketing.com"),

  // Testing & Control Modes
  DATA_MODE: z.enum(["live", "test"]).default("live"),
  MAX_TEST_BUSINESSES: z.coerce.number().int().positive().default(5),

  ADMIN_EMAIL: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  SALES_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal("").transform(() => undefined)),

  BASIC_AUTH_USERNAME: optionalNonEmpty,
  BASIC_AUTH_PASSWORD: optionalNonEmpty,

  OUTREACH_DAILY_LIMIT: z.coerce.number().int().positive().default(8),
  OUTREACH_MIN_DELAY_MINUTES: z.coerce.number().int().positive().default(20),
  OUTREACH_MAX_DELAY_MINUTES: z.coerce.number().int().positive().default(60),

  CLOUDFLARE_R2_ACCOUNT_ID: optionalNonEmpty,
  CLOUDFLARE_R2_ACCESS_KEY_ID: optionalNonEmpty,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: optionalNonEmpty,
  CLOUDFLARE_R2_BUCKET: optionalNonEmpty,
  CLOUDFLARE_R2_PUBLIC_URL: optionalUrl,

  // Analytics — internal event tracking is on by default; GA4 forwarding is
  // opt-in and only activates once both GA4 vars are supplied.
  ANALYTICS_ENABLED: boolFlag(true),
  ANALYTICS_DEBUG: boolFlag(false),
  GA4_MEASUREMENT_ID: optionalNonEmpty,
  GA4_API_SECRET: optionalNonEmpty,
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables. Copy .env.example to .env and fill in real values.\n${issues}`
    );
  }
  return result.data;
}

export const env = loadEnv();

/** Masks a secret for safe display in logs/diagnostics: keeps only the last 4 characters. */
export function maskSecret(value: string | undefined | null): string {
  if (!value) return "(not set)";
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

/**
 * Builds the DataForSEO Basic Authorization header value at call time.
 * Never persist or log the returned value.
 */
export function getDataForSeoAuthHeader(): string {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    throw new Error("DataForSEO is not configured — DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD are missing");
  }
  const token = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Per-integration configured/disabled status, safe to expose to the admin
 * integrations dashboard — booleans only, never the underlying values.
 */
export const integrationStatus = {
  openai: Boolean(env.OPENAI_API_KEY),
  googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
  dataforseo: Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD),
  apollo: Boolean(env.APOLLO_API_KEY),
  googleCalendar: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  gmail: Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD && env.EMAIL_FROM_ADDRESS),
  cloudflareR2: Boolean(
    env.CLOUDFLARE_R2_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_R2_BUCKET
  ),
  basicAuth: Boolean(env.BASIC_AUTH_USERNAME && env.BASIC_AUTH_PASSWORD),
  ga4: Boolean(env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET),
} as const;

export type IntegrationName = keyof typeof integrationStatus;
