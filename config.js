/* Backend connection. Fill in after creating the Supabase project. The anon key is public by design;
   row-level security protects the data. Never put the service-role key or the Anthropic key here. */
window.VIRTUOSO = {
  supabaseUrl: '',   // e.g. https://abcd1234.supabase.co
  anonKey: '',
  /* Set by the sign-in code once Supabase auth is wired in: async () => session access token */
  getAccessToken: null
};
