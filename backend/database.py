from datetime import datetime
from pathlib import Path
from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
DB_PATH = Path(__file__).resolve().parent / "voice_assistant.db"
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
class Base(DeclarativeBase):
    pass
class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(Integer, primary_key=True)
    user_query = Column(Text)
    assistant_response = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
class UserUsage(Base):
    __tablename__ = "user_usage"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True)
    count = Column(Integer, default=0)
    last_reset = Column(DateTime, default=datetime.utcnow)
Base.metadata.create_all(engine)