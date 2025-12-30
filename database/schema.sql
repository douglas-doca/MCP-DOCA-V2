-- ============================================
-- MCP-DOCA-V2 - Supabase Database Schema
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- ========== Tabela de Leads ==========
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  source TEXT DEFAULT 'whatsapp',
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);

-- ========== Tabela de Conversas ==========
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  lead_id TEXT REFERENCES leads(id),
  status TEXT DEFAULT 'new',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- ========== Tabela de Mensagens ==========
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- ========== Tabela de Templates ==========
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para templates
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- ========== Tabela de Sequências de Prospecção ==========
CREATE TABLE IF NOT EXISTS prospecting_sequences (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_name TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para prospecting_sequences
CREATE INDEX IF NOT EXISTS idx_sequences_lead ON prospecting_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON prospecting_sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_next_action ON prospecting_sequences(next_action_at);

-- ========== Row Level Security (RLS) ==========
-- Habilitar RLS em todas as tabelas
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_sequences ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role (acesso total)
CREATE POLICY "Service role has full access to leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to conversations" ON conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to messages" ON messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to templates" ON templates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to prospecting_sequences" ON prospecting_sequences
  FOR ALL USING (auth.role() = 'service_role');

-- ========== Funções úteis ==========

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON prospecting_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== Templates Iniciais ==========
INSERT INTO templates (id, name, category, content, variables) VALUES
  ('tpl-greeting', 'greeting', 'general', 'Olá{name}! 👋 Como posso te ajudar hoje?', '["name"]'),
  ('tpl-thanks', 'thanks', 'general', 'Obrigado pelo contato! 🙏 Estamos à disposição.', '[]'),
  ('tpl-goodbye', 'goodbye', 'general', 'Foi um prazer atendê-lo! Se precisar de mais alguma coisa, é só chamar. Até mais! 👋', '[]'),
  ('tpl-wait', 'wait', 'general', 'Só um momento, estou verificando isso para você... ⏳', '[]'),
  ('tpl-business-hours', 'business_hours', 'general', 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que retornaremos assim que possível!', '[]')
ON CONFLICT (name) DO NOTHING;

-- ========== Verificação ==========
-- Listar todas as tabelas criadas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
