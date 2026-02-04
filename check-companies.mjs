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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .limit(5);
  
  console.log('Companies:', companies);
  
  if (companies && companies.length > 0) {
    const companyId = companies[0].id;
    console.log('Using company_id:', companyId);
    
    // Create a test admin user entry
    const testUserId = crypto.randomUUID();
    const { data: inserted, error } = await supabase
      .from('admin_users')
      .insert({
        user_id: testUserId,
        company_id: companyId,
        email: 'qa-test@example.com',
        role: 'super_admin'
      })
      .select()
      .single();
    
    if (error) {
      console.log('Error creating admin:', error);
    } else {
      console.log('Created test admin:', inserted);
    }
  }
}

check();
