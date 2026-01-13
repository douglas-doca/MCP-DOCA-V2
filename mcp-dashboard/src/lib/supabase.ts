import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://llfwrwyqaswehksgvcyr.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('⚠️ VITE_SUPABASE_ANON_KEY não configurada no .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey || '')

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