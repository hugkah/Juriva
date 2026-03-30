from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.routes import auth_routes, chat_routes


# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="JURIVA API",
    description="Backend for Legal AI Assistant",
    version="1.0.0"
)

# CORS Configuration
origins = ["*"]  # Autorise toutes les origines pour le déploiement sur Vercel

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router)
app.include_router(chat_routes.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to JURIVA API"}
