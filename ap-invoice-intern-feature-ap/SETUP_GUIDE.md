# Recreating and Setting Up the AP Automation Project

If you have downloaded this project as a ZIP folder and want to recreate it on your system from scratch, follow the instructions, rules, and commands outlined below.

---

## 📋 Prerequisites
Before starting, ensure you have the following installed on your machine:
* **Docker & Docker Compose** (Highly recommended, as it runs all database and broker services automatically)
* **Python 3.11+** (Optional, if running services bare-metal)
* **Node.js 20+ & npm** (Optional, if running the frontend bare-metal)

---

## 🔌 Container Requirements

The project uses Docker Compose to orchestrate various services. Below is the breakdown of which containers are **mandatory** and which are **optional/non-essential**.

### 1. Mandatory Containers (Required to Run the App)
Without these containers, the application core (frontend, backend, database, and background workers) will fail to run:
* **`postgres` (`ap_postgres`)**: The PostgreSQL 16 database storing all tenant, user, invoice, and PO records.
* **`redis` (`ap_redis`)**: Celery message broker and cache, used for managing background tasks and rate-limiting.
* **`backend` (`ap_backend`)**: The FastAPI application serving REST APIs, AI/OCR extraction engines, and validation logic.
* **`frontend` (`ap_frontend`)**: The Next.js 14 web interface for review/approval workflows and dashboard visualization.
* **`celery_worker` (`ap_celery_worker`)**: Background worker executing heavy tasks (RapidOCR, Docling, and Groq LLM pipelines).
* **`celery_beat` (`ap_celery_beat`)**: Scheduler triggering periodic celery tasks.
* **`minio` (`ap_minio`)**: S3-compatible local object storage container storing uploaded invoice PDF/image documents.

### 2. Optional/Non-Essential Containers
These containers are **not required** for core invoice ingestion, validation, or workflows to function. Even if they are not built or run, the app will work normally:
* **`prometheus` (`ap_prometheus`)**: Metrics server collector. Non-essential for local functional development.
* **`grafana` (`ap_grafana`)**: Dashboard visualization tool for system metrics. Non-essential.
* **`greenmail` (`ap_greenmail`)**: A sandbox SMTP/IMAP server for intercepting outgoing notification emails locally. If mock emails are not needed, this container is not required.

---

## 🚀 Step-by-Step Recreation Steps

### Step 1: Extract the ZIP
Unzip the downloaded project folder on your system and navigate to the directory:
```bash
cd ap-invoice-intern
```

### Step 2: Configure Environment Variables
You must set up your environment configuration before starting the services:
1. Copy the sample environment file to create your active `.env`:
   ```bash
   cp .env.example .env
   ```
2. Generate a secure, unique cryptographically strong random hex token for user authentication (`JWT_SECRET`):
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. Open the `.env` file and replace the `JWT_SECRET` value with the output token:
   ```env
   JWT_SECRET=your_generated_hex_token_here
   ```
4. Configure external LLM API credentials in `.env` if you want to use the AI extraction features:
   * `GROQ_API_KEY` (Get from Groq Developer Console)
   * `GEMINI_API_KEY` (Get from Google AI Studio)

### Step 3: Run the Containers
Spin up all necessary services in detached mode:
```bash
docker compose up -d --build
```
> [!NOTE]
> If you wish to exclude the non-essential containers (Prometheus, Grafana, and Greenmail) to save system memory, run:
> ```bash
> docker compose up -d postgres redis backend frontend celery_worker celery_beat minio
> ```

---

## 🗄️ Database Seeding & User Credentials

Once your containers are up and running, you must run the migration and seeding scripts to populate the database with the pre-configured system users.

### Seeding Commands

Run the following commands inside the backend container to populate all system users, organizations, test invoices, and purchase orders:

```bash
# 1. Run the primary database seed script (Seeds base users, default organizations, invoices & POs)
docker exec -it ap_backend python -m app.seed.seed_db

# 2. Run the enterprise demo data script
docker exec -it ap_backend python scripts/seed_enterprise_data.py

# 3. Seed alternative testing organizations (Alpha & Beta) and users
docker exec -it ap_backend python seed_test_data.py
```

---

### 🔑 Predefined Seeded Users

All seeded accounts have the default password: **`Password123!`** (Alpha/Beta scripts use **`Password123!`** or **`SuperAdmin123!`** as described below).

#### 1. Primary Seed Users (`app.seed.seed_db` & `seed_enterprise_data.py`)
These are the primary users corresponding to default tenant organizations:

| User Name | Email Address | Role | Tenant Organization |
| :--- | :--- | :--- | :--- |
| **Nithin** | `nithin.super@company.com` | Super Admin | *Global (All Orgs)* |
| **Suprith** | `suprith@beverly.com` | Admin | Beverly |
| **Ranjitha** | `ranjitha@beverly.com` | Reviewer | Beverly |
| **Pooja** | `pooja@beverly.com` | Approver | Beverly |
| **Tharun** | `tharun@beverly.com` | Approver | Beverly |
| **Beverly Auditor** | `auditor@beverly.com` | Auditor | Beverly |
| **Global Admin** | `admin@global.com` | Admin | Global Industries |
| **Global Reviewer** | `reviewer@global.com` | Reviewer | Global Industries |
| **Innovate Admin** | `admin@innovate.com` | Admin | Innovate LLC |

#### 2. Extra Testing Suite Users (`seed_test_data.py`)
These users are seeded for alternative organization testing workflows:

| User Name | Email Address | Role | Tenant Organization | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Global Super Admin** | `superadmin@company.com` | Super Admin | *Global (All Orgs)* | `SuperAdmin123!` |
| **Admin Alpha** | `admin@alpha.com` | Admin | Alpha Corp | `Password123!` |
| **Reviewer Alpha** | `reviewer@alpha.com` | Reviewer | Alpha Corp | `Password123!` |
| **Approver Alpha** | `approver@alpha.com` | Approver | Alpha Corp | `Password123!` |
| **Admin Beta** | `admin@beta.com` | Admin | Beta Industries | `Password123!` |
| **Reviewer Beta** | `reviewer@beta.com` | Reviewer | Beta Industries | `Password123!` |
| **Approver Beta** | `approver@beta.com` | Approver | Beta Industries | `Password123!` |

---

## 🔍 Verifying the Setup

To verify that the seeding went through correctly and the database contains the users, you can inspect the PostgreSQL database directly:

1. Connect to the interactive `psql` console in the PostgreSQL container:
   ```bash
   docker exec -it ap_postgres psql -U postgres -d ap_db
   ```
2. Query the users table to verify seeded users:
   ```sql
   SELECT name, email, role, is_active FROM users;
   ```
3. Exit the PostgreSQL console:
   ```sql
   \q
   ```

You are now ready to access the web application at:
* **Frontend Web App:** `http://localhost:3000`
* **Backend API Docs:** `http://localhost:8000/docs`
