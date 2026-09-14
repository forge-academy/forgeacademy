from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
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
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=30)
    programme_key: str = Field(..., max_length=50)
    programme_label: str = Field(..., max_length=200)
    amount_expected: float = Field(..., ge=0)
    referral_code: Optional[str] = Field(None, max_length=50)
    discount_amount: float = Field(0, ge=0)
    ambassador_code: Optional[str] = Field(None, max_length=50)
    transfer_reference: str = Field(..., min_length=1, max_length=200)


class EnrollmentResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    programme_label: str
    amount_expected: float
    status: str
    created_at: datetime


class EnrollmentDeleteResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    deleted: bool = True


class PageViewCreate(BaseModel):
    path: str = Field(..., min_length=1, max_length=300)
    referrer: Optional[str] = Field(None, max_length=500)
    visitor_id: Optional[str] = Field(None, max_length=100)


class TrackResponse(BaseModel):
    ok: bool


class EnrollmentAdminItem(BaseModel):
    """Full enrollment row for the admin dashboard."""
    id: int
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    programme_key: str
    programme_label: str
    amount_expected: float
    referral_code: Optional[str] = None
    discount_amount: float = 0
    ambassador_code: Optional[str] = None
    transfer_reference: str
    status: str
    created_at: datetime
    verified_at: Optional[datetime] = None