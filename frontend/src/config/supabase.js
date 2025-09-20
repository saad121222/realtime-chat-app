import { createClient } from '@supabase/supabase-js'

// Direct Supabase configuration (no env vars needed)
const supabaseUrl = 'https://twmhgucjlylyuhythutc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bWhndWNqbHlseXVoeXRodXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NDEsImV4cCI6MjA3Mzk0Njg0MX0.6E5CRVS0SliR9gnHDRq2_lK0-5eGgok7K3Bch5loy5c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password, userData) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Database helpers
export const createChat = async (chatData) => {
  const { data, error } = await supabase
    .from('chats')
    .insert([chatData])
    .select()
    .single()
  return { data, error }
}

export const getChats = async (userId) => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .contains('participants', [userId])
    .order('updated_at', { ascending: false })
  return { data, error }
}

export const sendMessage = async (messageData) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([messageData])
    .select()
    .single()
  return { data, error }
}

export const getMessages = async (chatId) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!sender_id(id, username, avatar)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  return { data, error }
}

// Real-time subscriptions
export const subscribeToMessages = (chatId, callback) => {
  return supabase
    .channel(`messages:${chatId}`)
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      callback
    )
    .subscribe()
}

export const subscribeToChats = (userId, callback) => {
  return supabase
    .channel(`chats:${userId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'chats' },
      callback
    )
    .subscribe()
}
