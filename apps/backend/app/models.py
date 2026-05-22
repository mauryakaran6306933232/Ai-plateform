from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relations
    projects = relationship("Project", back_populates="owner")
    conversations = relationship("Conversation", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    repo_url = Column(String(500), nullable=True)
    language = Column(String(50), nullable=True)
    status = Column(String(50), default="created")  # created, analyzing, analyzed, error
    metadata_ = Column("metadata", JSON, default=dict)
    owner_id = Column(Integer, ForeignKey("users.id"))

    # Stats
    file_count = Column(Integer, default=0)
    line_count = Column(Integer, default=0)
    embeddings_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    files = relationship("ProjectFile", back_populates="project")
    workflows = relationship("Workflow", back_populates="project")


class ProjectFile(Base):
    __tablename__ = "project_files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    path = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    embeddings_id = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)

    project = relationship("Project", back_populates="files")


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="created")  # created, running, completed, failed
    agent_config = Column(JSON, default=dict)
    steps = Column(JSON, default=list)
    current_step = Column(Integer, default=0)

    # Results
    output = Column(JSON, default=dict)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="workflows")
    agent_runs = relationship("AgentRun", back_populates="workflow")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    agent_name = Column(String(100), nullable=False)
    agent_type = Column(String(50), nullable=False)  # planner, coder, tester, reviewer, refactor
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    input_ = Column("input", JSON, default=dict)
    output = Column(JSON, default=dict)
    tokens_used = Column(Integer, default=0)
    duration_ms = Column(Integer, default=0)
    error = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    workflow = relationship("Workflow", back_populates="agent_runs")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String(50), default="jarvis")  # jarvis, engineer, analytics
    messages = Column(JSON, default=list)
    context = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="conversations")


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    memory_type = Column(String(50), default="conversation")  # conversation, fact, preference, procedure
    importance = Column(Float, default=0.5)
    embedding_id = Column(String(255), nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)
    accessed_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)  # video, audio, text, alert
    source = Column(String(255), nullable=True)
    data = Column(JSON, default=dict)
    confidence = Column(Float, default=0.0)
    model_name = Column(String(100), nullable=True)
    processing_time_ms = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)