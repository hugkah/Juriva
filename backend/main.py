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
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Vite default
    "http://127.0.0.1:5173",
    "https://unbilled-sublanate-jessika.ngrok-free.dev",
]

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
