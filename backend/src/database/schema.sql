-- ProtoBuddy Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Components table
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    specifications JSONB NOT NULL,
    compatibility JSONB NOT NULL,
    datasheet_url TEXT,
    image_url TEXT,
    price DECIMAL(10,2),
    availability VARCHAR(50) DEFAULT 'unknown',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Boards table
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('microcontroller', 'sbc', 'dev-board')),
    specifications JSONB NOT NULL,
    supported_protocols JSONB NOT NULL,
    pins JSONB NOT NULL,
    compatibility TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    components TEXT[] DEFAULT '{}',
    board VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    tutorial_url TEXT,
    source_url TEXT,
    estimated_time VARCHAR(100),
    cost_min DECIMAL(10,2),
    cost_max DECIMAL(10,2),
    cost_currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraped data table
CREATE TABLE scraped_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL UNIQUE,
    title VARCHAR(500),
    content TEXT,
    images JSONB DEFAULT '[]',
    pdfs JSONB DEFAULT '[]',
    metadata JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    extracted_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compatibility cache table
CREATE TABLE compatibility_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL,
    component_id UUID NOT NULL,
    compatible BOOLEAN NOT NULL,
    issues JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
);

-- Chat sessions table
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    messages JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping queue table
CREATE TABLE scraping_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_components_name ON components USING gin(name gin_trgm_ops);
CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_manufacturer ON components(manufacturer);
CREATE INDEX idx_components_tags ON components USING gin(tags);
CREATE INDEX idx_components_specs ON components USING gin(specifications);

CREATE INDEX idx_boards_name ON boards USING gin(name gin_trgm_ops);
CREATE INDEX idx_boards_type ON boards(type);
CREATE INDEX idx_boards_manufacturer ON boards(manufacturer);

CREATE INDEX idx_projects_difficulty ON projects(difficulty);
CREATE INDEX idx_projects_tags ON projects USING gin(tags);
CREATE INDEX idx_projects_components ON projects USING gin(components);

CREATE INDEX idx_scraped_data_url ON scraped_data(url);
CREATE INDEX idx_scraped_data_processed ON scraped_data(processed);
CREATE INDEX idx_scraped_data_metadata ON scraped_data USING gin(metadata);

CREATE INDEX idx_compatibility_cache_board_component ON compatibility_cache(board_id, component_id);
CREATE INDEX idx_compatibility_cache_compatible ON compatibility_cache(compatible);

CREATE INDEX idx_chat_sessions_session_id ON chat_sessions(session_id);

CREATE INDEX idx_scraping_queue_status ON scraping_queue(status);
CREATE INDEX idx_scraping_queue_priority ON scraping_queue(priority DESC);
CREATE INDEX idx_scraping_queue_scheduled ON scraping_queue(scheduled_at);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON boards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraped_data_updated_at BEFORE UPDATE ON scraped_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compatibility_cache_updated_at BEFORE UPDATE ON compatibility_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraping_queue_updated_at BEFORE UPDATE ON scraping_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW component_summary AS
SELECT
    id,
    name,
    manufacturer,
    category,
    specifications->>'voltage' as voltage_info,
    specifications->>'communication' as communication_protocols,
    array_length(tags, 1) as tag_count,
    created_at
FROM components;

CREATE VIEW board_summary AS
SELECT
    id,
    name,
    manufacturer,
    type,
    specifications->>'processor' as processor,
    specifications->>'voltage' as voltage_info,
    created_at
FROM boards;

CREATE VIEW compatibility_summary AS
SELECT
    cc.id,
    b.name as board_name,
    c.name as component_name,
    cc.compatible,
    cc.score,
    array_length(cc.issues::json::text[], 1) as issue_count
FROM compatibility_cache cc
JOIN boards b ON cc.board_id = b.id
JOIN components c ON cc.component_id = c.id;