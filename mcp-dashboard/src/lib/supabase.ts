import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://llfwrwyqaswehksgvcyr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZndyd3lxYXN3ZWhrc2d2Y3lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjUyNjkxNiwiZXhwIjoyMDgyMTAyOTE2fQ.83D6r6kXCtty8Zp6_Ndwg3w1YC9Gi3oc1l9bI_qnU5k'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface Lead {
  id: string
  phone: string
  name?: string
  email?: string
  company?: string
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  source?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  phone: string
  chat_id: string
  status: 'active' | 'waiting_response' | 'closed' | 'escalated'
  lead_id?: string
  context?: any
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: any
}

// API Functions
export async function getStats() {
  const [leads, conversations, messages] = await Promise.all([
    supabase.from('leads').select('id, status'),
    supabase.from('conversations').select('id, status'),
    supabase.from('messages').select('id, role'),
  ])

  const activeConvs = conversations.data?.filter(c => c.status === 'active').length || 0
  const newLeads = leads.data?.filter(l => l.status === 'new').length || 0
  const qualifiedLeads = leads.data?.filter(l => l.status === 'qualified').length || 0

  return {
    totalLeads: leads.data?.length || 0,
    totalConversations: conversations.data?.length || 0,
    totalMessages: messages.data?.length || 0,
    activeConversations: activeConvs,
    newLeads,
    qualifiedLeads,
  }
}

export async function getConversations(limit = 20) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getMessages(conversationId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getLeads(limit = 50) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getRecentActivity(limit = 10) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, conversations(phone)')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

// Real-time subscriptions
export function subscribeToConversations(callback: (payload: any) => void) {
  return supabase
    .channel('conversations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, callback)
    .subscribe()
}

export function subscribeToMessages(callback: (payload: any) => void) {
  return supabase
    .channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, callback)
    .subscribe()
}
