-- Migration: Agent State Persistence for Oracle Multi-Agent
-- From LangGraph Checkpoint + MAW Guide
-- Oracle DB syntax only

-- Table: agent_states
CREATE TABLE agent_states (
  id VARCHAR2(36) PRIMARY KEY,
  agent_id VARCHAR2(36) NOT NULL,
  state_type VARCHAR2(50) NOT NULL,
  state_data CLOB NOT NULL,
  metadata CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX idx_agent_states_agent_id ON agent_states(agent_id);
CREATE INDEX idx_agent_states_state_type ON agent_states(state_type);
CREATE INDEX idx_agent_states_created_at ON agent_states(created_at);

-- Table: checkpoints
CREATE TABLE checkpoints (
  id VARCHAR2(36) PRIMARY KEY,
  thread_id VARCHAR2(36) NOT NULL,
  checkpoint_id VARCHAR2(100) NOT NULL,
  checkpoint_data CLOB NOT NULL,
  metadata CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT unique_thread_checkpoint UNIQUE (thread_id, checkpoint_id)
);

CREATE INDEX idx_checkpoints_thread_id ON checkpoints(thread_id);
CREATE INDEX idx_checkpoints_checkpoint_id ON checkpoints(checkpoint_id);

-- Table: memory_episodic
CREATE TABLE memory_episodic (
  id VARCHAR2(36) PRIMARY KEY,
  agent_id VARCHAR2(36) NOT NULL,
  episode_type VARCHAR2(50) NOT NULL,
  content CLOB NOT NULL,
  timestamp TIMESTAMP DEFAULT SYSTIMESTAMP,
  related_checkpoint_id VARCHAR2(36),
  CONSTRAINT fk_memory_episodic_checkpoint FOREIGN KEY (related_checkpoint_id) 
    REFERENCES checkpoints(id) ON DELETE SET NULL
);

CREATE INDEX idx_memory_episodic_agent_id ON memory_episodic(agent_id);
CREATE INDEX idx_memory_episodic_episode_type ON memory_episodic(episode_type);
CREATE INDEX idx_memory_episodic_timestamp ON memory_episodic(timestamp);

-- Table: memory_semantic
CREATE TABLE memory_semantic (
  id VARCHAR2(36) PRIMARY KEY,
  agent_id VARCHAR2(36) NOT NULL,
  embedding BLOB NOT NULL,
  content CLOB NOT NULL,
  metadata CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX idx_memory_semantic_agent_id ON memory_semantic(agent_id);

-- Table: memory_procedural
CREATE TABLE memory_procedural (
  id VARCHAR2(36) PRIMARY KEY,
  agent_id VARCHAR2(36) NOT NULL,
  skill_name VARCHAR2(100) NOT NULL,
  procedure_data CLOB NOT NULL,
  usage_count NUMBER DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX idx_memory_procedural_agent_id ON memory_procedural(agent_id);
CREATE INDEX idx_memory_procedural_skill_name ON memory_procedural(skill_name);

-- Sequence for ID generation (optional, can use UUID instead)
CREATE SEQUENCE seq_agent_state_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_checkpoint_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_memory_episodic_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_memory_semantic_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_memory_procedural_id START WITH 1 INCREMENT BY 1;
