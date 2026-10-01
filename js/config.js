// Zuri System · which database the app talks to · v1 · 2026-09-30
// TEST project (zuri-test). The publishable key is meant to be public; the database rules protect the data.
window.ZURI_CONFIG = {
  supabaseUrl: 'https://wlawjwowdmneatdffpsy.supabase.co',
  supabaseKey: 'sb_publishable_OHwCKJ0eGTS6MtiYX09U7Q_svZsAmmJ',
  env: 'test',
  // ?training → the Zuri Training database: a disguised copy of the real data, for the team to learn on.
  training: { supabaseUrl: 'https://dlpdjdswzfpmqymdswsg.supabase.co', supabaseKey: 'sb_publishable_DiInkgUuq_4vl6M-rC7B_g_whohrpB1' }
};
