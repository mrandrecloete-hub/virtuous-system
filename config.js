/* Backend connection. Fill in after creating the Supabase project. The anon key is public by design;
   row-level security protects the data. Never put the service-role key or the Anthropic key here. */
window.VIRTUOSO = {
  supabaseUrl: 'https://kpxqqntkbepaeosscaba.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtweHFxbnRrYmVwYWVvc3NjYWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDY2OTUsImV4cCI6MjEwODU4MjY5NX0.s_NuDev4ki0YyVJYEcxBLbInPs9TXrBI4WAusMhGHVI',
  /* Set by the sign-in code once Supabase auth is wired in: async () => session access token */
  getAccessToken: null
};
