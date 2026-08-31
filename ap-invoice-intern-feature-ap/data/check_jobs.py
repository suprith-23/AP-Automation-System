import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
import json

sys.path.insert(0, r"n:\PGM\AP-Automation-System\backend")
from app.core.database import SessionLocal
from app.models.job import Job

def check_jobs():
    db = SessionLocal()
    jobs = db.query(Job).order_by(Job.started_at.desc()).limit(10).all()
    for j in jobs:
        print(f"Job ID: {j.id} | Doc ID: {j.document_id} | Status: {j.status} | Stage: {j.current_stage}")

if __name__ == "__main__":
    check_jobs()
