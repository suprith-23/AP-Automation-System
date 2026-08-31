# AP Automation - Backend

This is the core FastAPI backend for the AP Automation System. It handles all business logic, database interactions, API endpoints, AI OCR extraction workflows, and multi-layered validation routing.

## Technology Stack

- **Framework**: FastAPI (Python 3.11)
- **Database ORM**: SQLAlchemy 
- **Migrations**: Alembic
- **Database**: PostgreSQL / SQLite (for testing)
- **AI/OCR**: Integration with RapidOCR, Docling, and Groq LLM

## Prerequisites

- Python 3.11+
- Virtual Environment (`venv`)
- PostgreSQL (if running in production mode)

## Getting Started

### 1. Setup Virtual Environment

Navigate to the root directory and activate your virtual environment:

```bash
# Windows
python -m venv myenv
myenv\Scripts\activate

# macOS/Linux
python3 -m venv myenv
source myenv/bin/activate
```

### 2. Install Dependencies

Install the necessary backend dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Ensure you have a `.env` file located in the root directory (one level up from `backend/`). This file must contain:
- `DATABASE_URL` (e.g., `postgresql://user:password@localhost/dbname`)
- `GROQ_API_KEY` (Required for LLM extraction)

*Reference `.env.example` at the root for a full list of required keys.*

### 4. Database Migrations & Seeding

Before running the server, apply the latest Alembic migrations and seed the database with required Master data (e.g., HSN codes, POs). Run this from the project root:

```bash
alembic upgrade head
python -m app.seed.seed_db
```

### 5. Run the Local Server

Start the FastAPI application. Run this command from the project root directory (not inside `backend/`):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The interactive API documentation (Swagger) will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Testing

The backend test suite leverages `pytest` and uses an isolated SQLite database to prevent interference with your local data. All tests reside in the top-level `testing/backend/` directory.

To run all backend tests from the root:

```bash
pytest testing/backend/
```

To run only unit tests:
```bash
pytest testing/backend/unit/
```

To run only integration tests:
```bash
pytest testing/backend/integration/
```

To run specific execution scripts (with backend root in PYTHONPATH):
```bash
# Windows PowerShell
$env:PYTHONPATH="backend"
python testing/backend/unit/test_pool_swapping.py
python testing/backend/integration/test_providers.py
```
