from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    country: Optional[str] = "France"

class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = None
    country: Optional[str] = None
    custom_instructions: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    country: Optional[str] = None
    custom_instructions: Optional[str] = None
    password: Optional[str] = None

class UserDelete(BaseModel):
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    email: EmailStr
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# Chat schemas
class MessageCreate(BaseModel):
    content: str

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    file_path: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    pass

class ConversationOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ConversationUpdate(BaseModel):
    title: str

class AskRequest(BaseModel):
    question: str
    conversation_id: int

class AskResponse(BaseModel):
    answer: str
    conversation_id: int
