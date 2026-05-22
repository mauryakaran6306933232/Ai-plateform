from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings
import asyncio

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    # FIX: Force connection timeout to 10 seconds.
    # Prevents the API from hanging for 60s if PostgreSQL is offline.
    connect_args={
        "timeout": 10 
    }
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    # Retry logic to wait for Postgres to be ready
    for attempt in range(10):
        try:
            from app.models import Base # Import here to avoid circular imports
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("■ Database initialized and tables synced")
            return
        except Exception as e:
            print(f"■ Waiting for PostgreSQL to start... (Attempt {attempt + 1}/10)")
            await asyncio.sleep(2) # Wait 2 seconds and try again

    print("■■ WARNING: Could not connect to PostgreSQL after 10 attempts.")
    print("■■ The server will run, but database features will not work.")