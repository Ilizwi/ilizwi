import "server-only";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient<any>>;

let _client: AnyClient | null = null;

/**
 * Service role client — bypasses RLS. Must only be used from server-side code
 * (server actions, route handlers, utilities). Never expose to the client bundle.
 */
export function getServiceClient(): AnyClient {
  if (!_client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _client = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}
