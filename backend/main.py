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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Changé à False pour fonctionner avec allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router)
app.include_router(chat_routes.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to JURIVA API"}
