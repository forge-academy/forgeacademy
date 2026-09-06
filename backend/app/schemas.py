from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional

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



class EnrollmentCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    programme_key: str
    programme_label: str
    amount_expected: float
    referral_code: Optional[str] = None
    discount_pct: float = 0
    transfer_reference: str


class EnrollmentResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    programme_label: str
    amount_expected: float
    status: str
    created_at: datetime