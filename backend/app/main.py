from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import init_db
from app.rate_limit import limiter
from app.routers import users, enrollments

app = FastAPI(title="ForgeAcademy API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# TODO: before going live, restrict this to the real frontend origin(s)
# instead of "*" — e.g. ["https://forgeacademy.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://forgeacademy.name.ng",
        # Admin dashboard served locally via VS Code Live Server (see .vscode/settings.json)
        "http://localhost:5501",
        "http://127.0.0.1:5501",
        "http://localhost:5502",
        "http://127.0.0.1:5502",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.on_event("startup")
def startup():
    init_db()


app.include_router(users.router)
app.include_router(enrollments.router)

@app.get("/health")
def health():
    return {"status": "ok"}