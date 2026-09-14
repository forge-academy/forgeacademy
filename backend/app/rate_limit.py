from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance — imported by app.main (to register it on the app)
# and by the routers (to decorate individual endpoints). Per-IP, in-memory;
# fine for a single-instance deployment and needs no extra infra (Redis etc).
limiter = Limiter(key_func=get_remote_address)
