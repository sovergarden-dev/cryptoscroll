export interface Env {
  NOTES_KV: KVNamespace;
  NOTE_VAULT: DurableObjectNamespace;
  NOTE_COUNTER: DurableObjectNamespace;
  CREATION_LIMITER: RateLimit;
  CREATION_LIMIT_SALT: string;
  ALLOWED_ORIGINS: string;
  ENVIRONMENT: string;
}
