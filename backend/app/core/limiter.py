from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared instance: main.py wires it into the app (state + exception handler + middleware),
# routes apply @limiter.limit(...) per-endpoint. Kept in its own module to avoid a circular
# import between main.py and api/routes/itinerary.py.
limiter = Limiter(key_func=get_remote_address)
