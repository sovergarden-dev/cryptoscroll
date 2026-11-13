export interface Env {
  NOTES_KV: KVNamespace;
  NOTE_VAULT: DurableObjectNamespace;
  NOTE_COUNTER: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  ENVIRONMENT: string;
}
