# # from fastapi import FastAPI
# # from fastapi.middleware.cors import CORSMiddleware
# # from contextlib import asynccontextmanager
# # from app.config import get_settings
# # from app.database import init_db
# # from app.routers import auth, agents, projects, workflows, jarvis, analytics, memory, monitoring, workspace
# # from app.websocket_manager import ws_manager
# # from app.services.metrics_stream_service import metrics_stream_service
# # import asyncio

# # settings = get_settings()

# # @asynccontextmanager
# # async def lifespan(app: FastAPI):
# #     # Startup
# #     print("■ Starting AI Platform...")
# #     await init_db()
# #     print("■ Database initialized")
    
# #     # Auto-start system metrics streaming
# #     asyncio.create_task(metrics_stream_service.start_system_stream())
# #     print("■ System metrics stream started")
    
# #     yield
    
# #     # Shutdown
# #     print("■ Shutting down AI Platform...")
# #     metrics_stream_service.stop_system_stream()

# # app = FastAPI(
# #     title=settings.APP_NAME,
# #     description="FAANG-Level AI Platform — Multi-Agent + AI OS + Multimodal Analytics",
# #     version="1.0.0",
# #     lifespan=lifespan,
# # )

# # # CORS
# # app.add_middleware(
# #     CORSMiddleware,
# #     allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
# #     allow_credentials=True,
# #     allow_methods=["*"],
# #     allow_headers=["*"],
# # )

# # # Routers
# # app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# # app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
# # app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
# # app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
# # app.include_router(jarvis.router, prefix="/api/jarvis", tags=["jarvis"])
# # app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
# # app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
# # app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])
# # app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])
# # # WebSocket
# # app.websocket("/ws")(ws_manager.websocket_endpoint)

# # @app.get("/")
# # async def root():
# #     return {
# #         "name": settings.APP_NAME,
# #         "version": "1.0.0",
# #         "status": "operational",
# #         "projects": ["AI Engineer", "AI OS (Jarvis)", "Multimodal Analytics"],
# #     }

# # @app.get("/health")
# # async def health():
# #     return {"status": "healthy"}
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from contextlib import asynccontextmanager
# from app.config import get_settings
# from app.database import init_db
# from app.routers import auth, agents, projects, workflows, jarvis, analytics, memory, monitoring, workspace
# from app.websocket_manager import ws_manager
# from app.services.metrics_stream_service import metrics_stream_service
# from app.services.proactive_service import proactive_service
# import asyncio

# settings = get_settings()

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Startup
#     print("■ Starting AI Platform...")
#     await init_db()
#     print("■ Database initialized")

#     # Auto-start system metrics streaming
#     asyncio.create_task(metrics_stream_service.start_system_stream())
#     print("■ System metrics stream started")

#     # NEW: Start Jarvis Proactive Monitoring
#     asyncio.create_task(proactive_service.start_proactive_loop())
#     print("■ Jarvis Proactive Mode activated")

#     yield

#     # Shutdown
#     print("■ Shutting down AI Platform...")
#     metrics_stream_service.stop_system_stream()
#     proactive_service.stop_proactive_loop()

# app = FastAPI(
#     title=settings.APP_NAME,
#     description="FAANG-Level AI Platform — Multi-Agent + AI OS + Multimodal Analytics",
#     version="1.0.0",
#     lifespan=lifespan,
# )

# # CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Routers
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
# app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
# app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
# app.include_router(jarvis.router, prefix="/api/jarvis", tags=["jarvis"])
# app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
# app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
# app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])
# app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])

# # WebSocket
# app.websocket("/ws")(ws_manager.websocket_endpoint)

# @app.get("/")
# async def root():
#     return {
#         "name": settings.APP_NAME,
#         "version": "1.0.0",
#         "status": "operational",
#         "projects": ["AI Engineer", "AI OS (Jarvis)", "Multimodal Analytics"],
#     }

# @app.get("/health")
# async def health():
#     return {"status": "healthy"}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.database import init_db
from app.routers import auth, agents, projects, workflows, jarvis, analytics, memory, monitoring, workspace
from app.websocket_manager import ws_manager
from app.services.metrics_stream_service import metrics_stream_service
from app.services.proactive_service import proactive_service
from app.services.scheduler_service import scheduler_service # NEW
import asyncio

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("■ Starting AI Platform...")
    await init_db()
    print("■ Database initialized")

    asyncio.create_task(metrics_stream_service.start_system_stream())
    print("■ System metrics stream started")

    asyncio.create_task(proactive_service.start_proactive_loop())
    print("■ Jarvis Proactive Mode activated")

    # NEW: Start the Routine Scheduler
    scheduler_service.start()
    print("■ Jarvis Routine Scheduler started")

    yield

    # Shutdown
    print("■ Shutting down AI Platform...")
    metrics_stream_service.stop_system_stream()
    proactive_service.stop_proactive_loop()
    scheduler_service.shutdown() # NEW

app = FastAPI(
    title=settings.APP_NAME,
    description="FAANG-Level AI Platform — Multi-Agent + AI OS + Multimodal Analytics",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(jarvis.router, prefix="/api/jarvis", tags=["jarvis"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])
app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])

# WebSocket
app.websocket("/ws")(ws_manager.websocket_endpoint)

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "operational",
        "projects": ["AI Engineer", "AI OS (Jarvis)", "Multimodal Analytics"],
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}