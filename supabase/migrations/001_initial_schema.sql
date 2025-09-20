-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    participants UUID[] NOT NULL DEFAULT '{}',
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video')),
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    read_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_content ON messages USING GIN(to_tsvector('english', content));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to mark chat messages as read
CREATE OR REPLACE FUNCTION mark_chat_messages_as_read(p_chat_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE messages 
    SET 
        read_by = CASE 
            WHEN p_user_id = ANY(read_by) THEN read_by
            ELSE array_append(read_by, p_user_id)
        END,
        is_read = TRUE,
        updated_at = NOW()
    WHERE chat_id = p_chat_id 
    AND sender_id != p_user_id
    AND NOT (p_user_id = ANY(read_by));
END;
$$ LANGUAGE plpgsql;

-- Create function for real-time notifications
CREATE OR REPLACE FUNCTION notify_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'new_message',
        json_build_object(
            'id', NEW.id,
            'chat_id', NEW.chat_id,
            'sender_id', NEW.sender_id,
            'content', NEW.content,
            'message_type', NEW.message_type,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message notifications
CREATE TRIGGER message_insert_notify
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_message_insert();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view all users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for chats table
CREATE POLICY "Users can view chats they participate in" ON chats
    FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Participants can update chats" ON chats
    FOR UPDATE USING (auth.uid() = ANY(participants));

-- Create RLS policies for messages table
CREATE POLICY "Users can view messages in their chats" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = messages.chat_id 
            AND auth.uid() = ANY(chats.participants)
        )
    );

CREATE POLICY "Users can send messages to their chats" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = messages.chat_id 
            AND auth.uid() = ANY(chats.participants)
        )
    );

CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (auth.uid() = sender_id);
