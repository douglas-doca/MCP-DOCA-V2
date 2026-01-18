require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const tables = ['social_proofs', 'social_proof', 'provas_sociais', 'testimonials', 'depoimentos', 'knowledge_base'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error && data) {
      console.log('Tabela:', table);
      console.log('Colunas:', Object.keys(data[0] || {}));
      console.log('---');
    }
  }
}
check();
