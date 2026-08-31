"""
Shared environment loader.
Ensures .env.local takes precedence over .env across all entry points.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

def init_env():
    # Locate project root (containing .env and .env.local)
    current_file = Path(__file__).resolve()
    # Go up from backend/app/core/env.py to project root
    project_root = current_file.parent.parent.parent.parent
    
    env_local = project_root / ".env.local"
    env_base = project_root / ".env"
    
    import sys
    is_testing = os.getenv("TESTING") == "True" or "pytest" in sys.modules
    prev_db_url = os.getenv("DATABASE_URL")
    
    if env_local.exists():
        load_dotenv(dotenv_path=env_local, override=True)
    if env_base.exists():
        load_dotenv(dotenv_path=env_base, override=False)
        
    if is_testing and prev_db_url:
        os.environ["DATABASE_URL"] = prev_db_url

# Auto-execute upon module import
init_env()
