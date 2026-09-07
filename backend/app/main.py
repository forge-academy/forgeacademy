from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import users, enrollments

app = FastAPI(title="ForgeAcademy API", version="0.1.0")

# TODO: before going live, restrict this to the real frontend origin(s)
# instead of "*" — e.g. ["https://forgeacademy.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://forgeacademy.name.ng"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(users.router)
app.include_router(enrollments.router)

@app.get("/health")
def health():
    return {"status": "ok"}