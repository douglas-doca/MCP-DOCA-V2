import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Settings, 
  Zap,
  Brain,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Send,
  Plug,
  X,
  Play,
  Save,
  Plus,
  Trash2
} from 'lucide-react'
import { 
  getStats, 
  getConversations, 
  getMessages, 
  getLeads,
  subscribeToMessages,
  subscribeToConversations,
  Conversation,
  Message,
  Lead
} from './lib/supabase'
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

const API_BASE = ''

async function getPrompt(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/settings?key=agent_prompt`)
  if (res.ok) { const data = await res.json(); return data.value || '' }
  return ''
}

async function savePrompt(value: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'agent_prompt', value })
  })
  return res.ok
}

async function getKnowledge(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/knowledge`)
  if (res.ok) return res.json()
  return []
}

async function saveKnowledge(data: any): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/knowledge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.ok
}

async function deleteKnowledge(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/knowledge`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  return res.ok
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    loadData()
    const msgSub = subscribeToMessages(() => { setLastUpdate(new Date()); loadData() })
    const convSub = subscribeToConversations(() => { setLastUpdate(new Date()); loadData() })
    const interval = setInterval(loadData, 30000)
    return () => { msgSub.unsubscribe(); convSub.unsubscribe(); clearInterval(interval) }
  }, [])

  const loadData = async () => {
    try {
      const [statsData, convsData, leadsData] = await Promise.all([
        getStats(), getConversations(50), getLeads(50)
      ])
      setStats(statsData)
      setConversations(convsData || [])
      setLeads(leadsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const loadMessages = async (conv: Conversation) => {
    setSelectedConversation(conv)
    const msgs = await getMessages(conv.id)
    setMessages(msgs || [])
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'conversations', label: 'Conversas', icon: MessageSquare },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'funnel', label: 'Funil', icon: TrendingUp },
    { id: 'training', label: 'Treinamento', icon: Brain },
    { id: 'integrations', label: 'Integrações', icon: Plug },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-[#f57f17] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando Central de Comando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-black">
      <aside className="w-64 bg-black border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src="https://assets.zyrosite.com/Yan0w5Vy86ho0JE8/logfodo-k4TpXLZg5xKBcNIy.png" alt="DOCA AI" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-white">DOCA AI</h1>
              <p className="text-xs text-gray-500">Central de Comando</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    currentPage === item.id ? 'bg-[#f57f17]/20 text-[#f57f17] border border-[#f57f17]/30' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                  }`}>
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Agente Online</span>
            </div>
            <p className="text-xs text-gray-500">Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-black/50 backdrop-blur border-b border-gray-800 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{menuItems.find(m => m.id === currentPage)?.label}</h2>
              <p className="text-gray-500 text-sm">
                {currentPage === 'training' && 'Configure o prompt e base de conhecimento do agente'}
                {currentPage === 'funnel' && 'Acompanhe suas conversas em cada fase do funil'}
              </p>
            </div>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-[#f57f17] hover:bg-gray-900 rounded-lg transition-all">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-8">
          {currentPage === 'dashboard' && <DashboardPage stats={stats} conversations={conversations} />}
          {currentPage === 'conversations' && <ConversationsPage conversations={conversations} selectedConversation={selectedConversation} messages={messages} onSelectConversation={loadMessages} />}
          {currentPage === 'leads' && <LeadsPage leads={leads} />}
          {currentPage === 'funnel' && <FunnelPage conversations={conversations} />}
          {currentPage === 'training' && <TrainingPage />}
          {currentPage === 'integrations' && <IntegrationsPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}

function DashboardPage({ stats, conversations }: any) {
  const statCards = [
    { label: 'Total Conversas', value: stats?.totalConversations || 0, icon: MessageSquare, color: 'orange' },
    { label: 'Conversas Ativas', value: stats?.activeConversations || 0, icon: Clock, color: 'green' },
    { label: 'Total Leads', value: stats?.totalLeads || 0, icon: Users, color: 'orange' },
    { label: 'Leads Qualificados', value: stats?.qualifiedLeads || 0, icon: CheckCircle, color: 'green' },
  ]
  const chartData = [
    { name: 'Seg', conversas: 12, leads: 4 }, { name: 'Ter', conversas: 19, leads: 7 },
    { name: 'Qua', conversas: 15, leads: 5 }, { name: 'Qui', conversas: 25, leads: 9 },
    { name: 'Sex', conversas: 22, leads: 8 }, { name: 'Sab', conversas: 8, leads: 2 },
    { name: 'Dom', conversas: 5, leads: 1 },
  ]
  const emotionColors: Record<string, string> = {
    excited: '#28A745', curious: '#f57f17', ready: '#17A2B8',
    neutral: '#6b7280', anxious: '#FFC107', skeptical: '#fd7e14',
    frustrated: '#dc3545', price_sensitive: '#9333ea'
  }
  const emotionNames: Record<string, string> = {
    excited: 'Empolgado', curious: 'Curioso', ready: 'Pronto',
    neutral: 'Neutro', anxious: 'Ansioso', skeptical: 'Cético',
    frustrated: 'Frustrado', price_sensitive: 'Preço'
  }
  const emotionData = stats?.emotionStats ? Object.entries(stats.emotionStats).map(([key, value]) => ({
    name: emotionNames[key] || key, value: value as number, color: emotionColors[key] || '#6b7280'
  })) : [
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-[#f57f17]/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.color === 'orange' ? 'bg-[#f57f17]/10' : 'bg-green-500/10'}`}>
                <stat.icon className={`w-6 h-6 ${stat.color === 'orange' ? 'text-[#f57f17]' : 'text-green-400'}`} />
              </div>
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-gray-500 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Atividade Semanal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Bar dataKey="conversas" fill="#f57f17" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leads" fill="#D94A00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Emoções Detectadas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={emotionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {emotionData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {emotionData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-400 text-sm">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Conversas Recentes</h3>
        <div className="space-y-4">
          {conversations.slice(0, 5).map((conv: Conversation) => (
            <div key={conv.id} className="flex items-center justify-between p-4 bg-black/50 rounded-xl hover:bg-black transition-all cursor-pointer border border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#f57f17] to-[#D94A00] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">{conv.phone?.slice(-2) || '??'}</span>
                </div>
                <div>
                  <p className="text-white font-medium">{conv.phone || 'Desconhecido'}</p>
                  <p className="text-gray-500 text-sm">{new Date(conv.updated_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${conv.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {conv.status === 'active' ? 'Ativa' : conv.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConversationsPage({ conversations, selectedConversation, messages, onSelectConversation }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar..." className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none" />
          </div>
        </div>
        <div className="overflow-y-auto h-full">
          {conversations.map((conv: Conversation) => (
            <div key={conv.id} onClick={() => onSelectConversation(conv)}
              className={`p-4 border-b border-gray-800 cursor-pointer transition-all ${selectedConversation?.id === conv.id ? 'bg-[#f57f17]/20 border-l-4 border-l-[#f57f17]' : 'hover:bg-gray-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">{conv.phone}</p>
                <span className={`w-2 h-2 rounded-full ${conv.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
              </div>
              <p className="text-gray-500 text-sm">{new Date(conv.updated_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#f57f17] to-[#D94A00] rounded-full flex items-center justify-center">
                <span className="text-white font-medium">{selectedConversation.phone?.slice(-2)}</span>
              </div>
              <div>
                <p className="text-white font-medium">{selectedConversation.phone}</p>
                <p className="text-gray-500 text-sm">{selectedConversation.status === 'active' ? '🟢 Ativa' : '⚪ Inativa'}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg: Message) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-[#f57f17] text-white'}`}>
                    <p>{msg.content}</p>
                    <p className="text-xs opacity-60 mt-2">{new Date(msg.timestamp).toLocaleTimeString('pt-BR')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800">
              <div className="flex items-center gap-4">
                <input type="text" placeholder="Mensagem manual..." className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#f57f17]" />
                <button className="p-3 bg-[#f57f17] text-white rounded-xl hover:bg-[#D94A00]"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LeadsPage({ leads }: { leads: Lead[] }) {
  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400', contacted: 'bg-yellow-500/20 text-yellow-400',
    qualified: 'bg-green-500/20 text-green-400', proposal: 'bg-[#f57f17]/20 text-[#f57f17]',
    won: 'bg-emerald-500/20 text-emerald-400', lost: 'bg-red-500/20 text-red-400',
  }
  const statusLabels: Record<string, string> = {
    new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', proposal: 'Proposta', won: 'Ganho', lost: 'Perdido',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left p-4 text-gray-400 font-medium">Contato</th>
            <th className="text-left p-4 text-gray-400 font-medium">Nome</th>
            <th className="text-left p-4 text-gray-400 font-medium">Status</th>
            <th className="text-left p-4 text-gray-400 font-medium">Criado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="p-4 text-white">{lead.phone}</td>
              <td className="p-4 text-white">{lead.name || '-'}</td>
              <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>{statusLabels[lead.status]}</span></td>
              <td className="p-4 text-gray-400">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FunnelPage({ conversations }: { conversations: Conversation[] }) {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)
  
  const getPhase = (conv: Conversation) => {
    const context = (conv as any).context
    if (context?.phase !== undefined) return context.phase
    if (true) return 0
    if (conv.status === 'active') return 1
    if (conv.status === 'waiting_response') return 2
    if (conv.status === 'escalated') return 3
    if (conv.status === 'closed') return 4
    return 0
  }

  const phases = [
    { id: 0, name: 'Descoberta', color: '#f57f17', icon: '🔍', desc: 'Primeiro contato' },
    { id: 1, name: 'Qualificação', color: '#D94A00', icon: '📋', desc: 'Entendendo necessidades' },
    { id: 2, name: 'Apresentação', color: '#fd7e14', icon: '🎯', desc: 'Mostrando soluções' },
    { id: 3, name: 'Proposta', color: '#FFC107', icon: '📝', desc: 'Negociação' },
    { id: 4, name: 'Fechamento', color: '#28A745', icon: '🤝', desc: 'Conversão' },
  ]

  const conversationsByPhase = phases.map(phase => ({
    ...phase,
    conversations: conversations.filter(c => getPhase(c) === phase.id)
  }))

  const maxCount = Math.max(...conversationsByPhase.map(p => p.conversations.length), 1)
  const totalConversations = conversations.length

  return (
    <div className="space-y-6">
      {/* Funil Visual */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">Funil de Conversão</h3>
        <div className="space-y-3 max-w-3xl mx-auto">
          {conversationsByPhase.map((phase, i) => (
            <div key={i} onClick={() => setSelectedPhase(selectedPhase === phase.name ? null : phase.name)}
              className={`h-14 rounded-xl flex items-center justify-between px-6 cursor-pointer transition-all hover:scale-[1.02] ${selectedPhase === phase.name ? 'ring-2 ring-white' : ''}`}
              style={{ 
                backgroundColor: phase.color + '40',
                width: `${Math.max((phase.conversations.length / maxCount) * 100, 30)}%`,
                minWidth: '250px', margin: '0 auto',
                borderLeft: `4px solid ${phase.color}`
              }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{phase.icon}</span>
                <div>
                  <span className="text-white font-medium">{phase.name}</span>
                  <p className="text-gray-400 text-xs">{phase.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xl">{phase.conversations.length}</span>
                <span className="text-gray-400 text-sm">({totalConversations > 0 ? Math.round((phase.conversations.length / totalConversations) * 100) : 0}%)</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Taxas de conversão */}
        <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-800 flex-wrap">
          {conversationsByPhase.slice(0, 4).map((phase, i) => {
            const next = conversationsByPhase[i + 1]
            const rate = phase.conversations.length > 0 ? Math.round((next?.conversations.length / phase.conversations.length) * 100) : 0
            return (
              <div key={i} className="text-center px-4">
                <p className="text-2xl font-bold" style={{ color: phase.color }}>{rate}%</p>
                <p className="text-gray-500 text-xs">{phase.name} → {next?.name}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {conversationsByPhase.map((phase, i) => (
          <div key={i} onClick={() => setSelectedPhase(selectedPhase === phase.name ? null : phase.name)}
            className={`bg-gray-900 border rounded-xl p-4 text-center cursor-pointer transition-all hover:scale-105 ${selectedPhase === phase.name ? 'border-white' : 'border-gray-800 hover:border-[#f57f17]/30'}`}>
            <span className="text-3xl">{phase.icon}</span>
            <p className="text-2xl font-bold text-white mt-2">{phase.conversations.length}</p>
            <p className="text-gray-500 text-xs">{phase.name}</p>
          </div>
        ))}
      </div>

      {/* Conversas da fase selecionada */}
      {selectedPhase && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>{conversationsByPhase.find(p => p.name === selectedPhase)?.icon}</span>
              {selectedPhase}
              <span className="text-gray-500 font-normal text-sm">
                ({conversationsByPhase.find(p => p.name === selectedPhase)?.conversations.length} conversas)
              </span>
            </h3>
            <button onClick={() => setSelectedPhase(null)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {conversationsByPhase.find(p => p.name === selectedPhase)?.conversations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma conversa nesta fase</p>
            ) : (
              conversationsByPhase.find(p => p.name === selectedPhase)?.conversations.map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-4 bg-black/50 rounded-xl border border-gray-800 hover:border-[#f57f17]/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#f57f17] to-[#D94A00] rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">{conv.phone?.slice(-2)}</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{conv.phone}</p>
                      <p className="text-gray-500 text-sm">{new Date(conv.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${conv.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {conv.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TrainingPage() {
  const [prompt, setPrompt] = useState('')
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [showSimulator, setShowSimulator] = useState(false)
  const [showFAQ, setShowFAQ] = useState(false)
  const [testMessages, setTestMessages] = useState<{role: string, content: string}[]>([])
  const [testInput, setTestInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingPrompt, setLoadingPrompt] = useState(true)

  useEffect(() => { loadPrompt(); loadKnowledgeBase() }, [])

  const loadPrompt = async () => { setLoadingPrompt(true); setPrompt(await getPrompt()); setLoadingPrompt(false) }
  const loadKnowledgeBase = async () => { setKnowledge(await getKnowledge()) }

  const handleSave = async () => {
    setSaving(true)
    if (await savePrompt(prompt)) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  const handleSaveFAQ = async (item: any) => { await saveKnowledge(item); await loadKnowledgeBase() }
  const handleDeleteFAQ = async (id: string) => { await deleteKnowledge(id); await loadKnowledgeBase() }
  const handleAddFAQ = async () => { await saveKnowledge({ question: 'Nova pergunta', answer: 'Resposta...', category: 'geral', priority: 0 }); await loadKnowledgeBase() }

  const handleTestSend = () => {
    if (!testInput.trim()) return
    setTestMessages(prev => [...prev, { role: 'user', content: testInput }])
    setTestInput('')
    setTimeout(() => {
      const responses = [
        "E aí! 👋 Tudo bem? Aqui é o Douglas da DOCA. Como posso te ajudar?",
        "Show! Me conta mais sobre seu negócio, o que você tá precisando resolver?",
        "Entendi! A gente tem uma solução perfeita pra isso. Que tal marcar uma call de 30 min?",
      ]
      setTestMessages(prev => [...prev, { role: 'assistant', content: responses[Math.min(testMessages.length, 2)] }])
    }, 1000)
  }

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Prompt do Agente</h3>
            <p className="text-gray-500 text-sm">Identidade, regras e comportamento do Douglas</p>
          </div>
          <button onClick={handleSave} disabled={saving || loadingPrompt}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${saved ? 'bg-green-500 text-white' : 'bg-[#f57f17] text-white hover:bg-[#D94A00]'} disabled:opacity-50`}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
        {loadingPrompt ? (
          <div className="h-96 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-[#f57f17] animate-spin" /></div>
        ) : (
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-96 bg-black text-white placeholder-gray-500 rounded-xl p-4 outline-none focus:ring-2 focus:ring-[#f57f17] resize-none font-mono text-sm border border-gray-800" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Brain className="w-8 h-8 text-[#f57f17] mb-4" />
          <h4 className="text-white font-semibold mb-2">Testar Resposta</h4>
          <p className="text-gray-500 text-sm mb-4">Simule uma conversa para testar</p>
          <button onClick={() => setShowSimulator(true)} className="w-full py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Abrir Simulador
          </button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Zap className="w-8 h-8 text-[#f57f17] mb-4" />
          <h4 className="text-white font-semibold mb-2">Base de Conhecimento</h4>
          <p className="text-gray-500 text-sm mb-4">{knowledge.length} perguntas cadastradas</p>
          <button onClick={() => setShowFAQ(true)} className="w-full py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700">Gerenciar FAQ</button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Settings className="w-8 h-8 text-green-400 mb-4" />
          <h4 className="text-white font-semibold mb-2">Status do Agente</h4>
          <p className="text-gray-500 text-sm mb-4">Prompt carregado do banco</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm">Sincronizado</span>
          </div>
        </div>
      </div>

      {showSimulator && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Simulador de Conversa</h3>
              <button onClick={() => { setShowSimulator(false); setTestMessages([]) }} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
              {testMessages.length === 0 && <p className="text-gray-500 text-center py-8">Digite uma mensagem para iniciar</p>}
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-[#f57f17] text-white'}`}>{msg.content}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800 flex gap-4">
              <input value={testInput} onChange={(e) => setTestInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleTestSend()}
                placeholder="Digite como cliente..." className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#f57f17]" />
              <button onClick={handleTestSend} className="p-3 bg-[#f57f17] text-white rounded-xl hover:bg-[#D94A00]"><Send className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {showFAQ && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Base de Conhecimento ({knowledge.length})</h3>
              <button onClick={() => setShowFAQ(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {knowledge.map((item) => (
                <div key={item.id} className="bg-black rounded-xl p-4 border border-gray-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <input defaultValue={item.question} onBlur={(e) => handleSaveFAQ({ ...item, question: e.target.value })}
                        className="w-full bg-transparent text-white font-semibold outline-none border-b border-transparent focus:border-[#f57f17]" />
                      <textarea defaultValue={item.answer} onBlur={(e) => handleSaveFAQ({ ...item, answer: e.target.value })}
                        className="w-full bg-gray-900 text-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-[#f57f17] resize-none h-20 border border-gray-800" />
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Categoria: {item.category}</span>
                        <span>Prioridade: {item.priority}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteFAQ(item.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <button onClick={handleAddFAQ} className="w-full py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 border border-dashed border-gray-600 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar Pergunta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IntegrationsPage() {
  const integrations = [
    { name: 'WAHA', description: 'WhatsApp API', status: 'connected', icon: '📱' },
    { name: 'Supabase', description: 'Banco de dados', status: 'connected', icon: '🗄️' },
    { name: 'Google Calendar', description: 'Agendamentos', status: 'available', icon: '📅' },
    { name: 'Google Meet', description: 'Videoconferência', status: 'available', icon: '🎥' },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {integrations.map((int, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-[#f57f17]/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-4xl">{int.icon}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${int.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {int.status === 'connected' ? 'Conectado' : 'Disponível'}
            </span>
          </div>
          <h4 className="text-white font-semibold mb-1">{int.name}</h4>
          <p className="text-gray-500 text-sm mb-4">{int.description}</p>
          <button className={`w-full py-2 rounded-xl ${int.status === 'connected' ? 'bg-gray-800 text-gray-400' : 'bg-[#f57f17] text-white hover:bg-[#D94A00]'}`}>
            {int.status === 'connected' ? 'Configurar' : 'Conectar'}
          </button>
        </div>
      ))}
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Configurações do Agente</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Nome do Agente</label>
            <input type="text" defaultValue="Douglas" className="w-full bg-black text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#f57f17] border border-gray-800" />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Modelo de IA</label>
            <select className="w-full bg-black text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#f57f17] border border-gray-800">
              <option>Claude Sonnet 4 (Recomendado)</option>
              <option>Claude 3.5 Haiku (Rápido)</option>
            </select>
          </div>
        </div>
      </div>
      <button className="w-full py-4 bg-[#f57f17] text-white font-semibold rounded-2xl hover:bg-[#D94A00]">Salvar Configurações</button>
    </div>
  )
}

export default App
// force rebuild Thu Dec 25 13:08:44 UTC 2025
