const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['scripts/migrate_run.ts'],
  outfile: 'scripts/migrate_run.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://wywgkikkjgbnlljkkmnz.supabase.co"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"'
  },
  external: ['xlsx', '@supabase/supabase-js']
});
console.log('Build successful');
