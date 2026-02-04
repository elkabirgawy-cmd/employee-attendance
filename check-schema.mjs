import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  const envFile = readFileSync('.env', 'utf-8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Try to insert with minimal fields
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: 'Test Company'
    })
    .select()
    .single();
  
  console.log('Insert result:', data);
  console.log('Error:', error);
}

check();
