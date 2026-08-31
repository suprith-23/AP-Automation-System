# AP Automation System — Command Reference & User Manual

This document contains the exact CLI commands needed to initialize, configure, seed, run, inspect, and troubleshoot the AP Automation System inside your Docker environment.

---

## 1. Container Lifecycle Commands

Manage the core application containers (Frontend, Backend, Database, Object Storage).

```bash
# Build and boot up all services in the background
docker compose up -d --build

# Inspect status of all active containers
docker compose ps

# Follow logs for all services in real time
docker compose logs -f

# Stop and remove all containers, networks, and volumes
docker compose down -v

# Restart all services (Forces loading of updated configuration)
docker compose restart
```

---

## 2. Environment Configuration & API Keys Setup

Copy the template file in the root folder to create your active environment file:

```bash
cp .env.example .env
```

### 1. Generating a Secure JWT Secret Key
The `JWT_SECRET` variable is used to sign and authenticate user login sessions. Do not leave it as default. Generate a secure 32-character random hex string:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Copy the output value and set it as `JWT_SECRET` inside your `.env` file:
```env
JWT_SECRET=your_generated_hex_string_here
```

### 2. External AI Service Keys
Configure the key variables in `.env` to connect with LLM providers for invoice parsing:
- **Groq API Key (`GROQ_API_KEY`)**: Obtain from the [Groq Developer Console](https://console.groq.com/keys).
- **Gemini API Key (`GEMINI_API_KEY`)**: Obtain from the [Google AI Studio Console](https://aistudio.google.com/).
- **Nvidia NIM API Key (`NVIDIA_API_KEY`)**: Obtain from the [Nvidia Build Portal](https://build.nvidia.com/).
- **Hugging Face Token (`HF_TOKEN` / `HF_API_KEY`)**: Obtain from your [Hugging Face User Access Tokens Settings](https://huggingface.co/settings/tokens).
- **Google Colab Ngrok Link (`REMOTE_COLAB_URL`)**: Set to your custom ngrok forwarding address if using a remote Jupyter backend.

---

## 3. Seeding Initial Users & Data

To seed the database with initial configurations, superadmin, and organization models, run these commands:

```bash
# 1. Run the database seed script to populate base users, settings, and templates
docker exec -it ap_backend python -m app.seed.seed_db

# 2. Run the enterprise data seed script to populate test invoices and purchase orders
docker exec -it ap_backend python scripts/seed_enterprise_data.py

# 3. Seed additional test extraction pipelines (Optional)
docker exec -it ap_backend python seed_test_data.py
```

---

## 4. Database Access & Inspection (PostgreSQL)

Inspect tables, verify seeded records, and execute direct SQL queries inside the running `ap_postgres` database container.

```bash
# 1. Enter the interactive PostgreSQL command line (psql) inside the container
docker exec -it ap_postgres psql -U postgres -d ap_db

# 2. SQL Commands to inspect tables inside psql:
# ---------------------------------------------------------
# List all tables in the database:
\dt

# View all registered users and their assigned roles:
SELECT name, email, role, is_active FROM users;

# View all registered organizations:
SELECT name, domain, created_at FROM organizations;

# View all seeded invoices:
SELECT invoice_number, vendor_name, total_amount, status FROM invoices;

# Exit the psql console:
\q
```

---

## 5. Database Migrations (Alembic)

Apply schema updates or review migration histories inside the `ap_backend` container.

```bash
# Run all pending migrations to upgrade the schema to the latest version
docker exec -it ap_backend alembic upgrade head

# Revert the last applied database migration
docker exec -it ap_backend alembic downgrade -1

# Show the history of applied and pending migrations
docker exec -it ap_backend alembic history --verbose

# Show the currently active migration version
docker exec -it ap_backend alembic current
```

---

## 6. Troubleshooting Sync & Refresh Issues

### Next.js Hot Reloading Lag
If code changes do not reflect in the browser due to Windows Docker volume event lag, restart the dev server container:
```bash
docker compose restart frontend
```

### Resetting the Database Environment
If you need to wipe and reset the entire database to a clean state:
```bash
# 1. Stop containers and destroy volumes
docker compose down -v

# 2. Boot up container clean
docker compose up -d

# 3. Run migrations
docker exec -it ap_backend alembic upgrade head

# 4. Seed initial database data
docker exec -it ap_backend python -m app.seed.seed_db
docker exec -it ap_backend python scripts/seed_enterprise_data.py
```
