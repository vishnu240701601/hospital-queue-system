import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")


def get_supabase_client() -> Client:
    """Create and return a Supabase client using the service role key."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)
