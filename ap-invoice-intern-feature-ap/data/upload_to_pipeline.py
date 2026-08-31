import os
import requests

def main():
    BASE_URL = "http://localhost:8000/api/v1"
    
    print("1. Authenticating as Admin...")
    session = requests.Session()
    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "email": "suprith@beverly.com",
        "password": "Password123!"
    })
    
    if login_res.status_code != 200:
        print("Failed to login! Make sure the server is running and user exists.")
        print(login_res.text)
        return
        
    print("Login successful.")
    
    images_dir = "n:/PGM/AP-Automation-System/data/hf_invoices/images"
    if not os.path.exists(images_dir):
        print(f"Directory {images_dir} not found.")
        return
        
    for i in range(5):
        filename = f"invoice_{i}.jpg"
        filepath = os.path.join(images_dir, filename)
        
        if os.path.exists(filepath):
            print(f"Uploading {filename} to the pipeline...")
            with open(filepath, "rb") as f:
                # The API expects form data with 'file'
                files = {"file": (filename, f, "image/jpeg")}
                upload_res = session.post(f"{BASE_URL}/documents/upload", files=files)
                
            if upload_res.status_code in (200, 201):
                doc_id = upload_res.json().get("document_id")
                print(f"Uploaded successfully! Document ID: {doc_id}")
            else:
                print(f"Failed to upload {filename}:", upload_res.text)
        else:
            print(f"File {filepath} not found.")

if __name__ == "__main__":
    main()
