from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRegisterRequest(BaseModel):
    name: str
    email: EmailStr


class UserRegisterResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime
    email_sent: bool


class ErrorResponse(BaseModel):
    detail: str