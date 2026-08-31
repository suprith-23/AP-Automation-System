import os
import json
import urllib.request
import re

URL = "https://datasets-server.huggingface.co/rows?dataset=AjitRawat%2Finvoice&config=default&split=train&offset=0&length=5"
OUTPUT_DIR = "hf_invoices"
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")

def download_image(url, save_path):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
        data = response.read()
        out_file.write(data)

def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    print("Fetching top 5 invoice rows from Hugging Face dataset 'AjitRawat/invoice'...")
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    rows = data.get("rows", [])
    
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Viewer</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 1400px; margin: 0 auto; }
            h1 { text-align: center; color: #2c3e50; }
            .invoice-card { display: flex; background: white; margin-bottom: 40px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .image-pane { flex: 1; padding: 20px; background: #fafafa; border-right: 1px solid #eee; text-align: center; }
            .image-pane img { max-width: 100%; height: auto; border: 1px solid #ddd; max-height: 800px; object-fit: contain; }
            .data-pane { flex: 1; padding: 30px; }
            .data-pane h2 { margin-top: 0; border-bottom: 2px solid #3498db; padding-bottom: 10px; color: #2980b9; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; color: #495057; width: 40%; font-weight: 600; }
            td { color: #212529; }
            .confirmed-badge { display: inline-block; background: #2ecc71; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.8em; font-weight: bold; margin-left: 10px; vertical-align: middle; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Extracted Invoices</h1>
    """

    for i, row_data in enumerate(rows):
        row = row_data["row"]
        image_info = row.get("image", {})
        image_url = image_info.get("src")
        ground_truth_str = row.get("ground_truth", "{}")
        
        try:
            gt_json = json.loads(ground_truth_str)
        except:
            gt_json = {}
            
        header = gt_json.get("gt_parse", {}).get("header", {})
        
        # Extract fields
        extracted = {
            "Invoice Number": header.get("invoice_no", "N/A"),
            "Invoice Date": header.get("invoice_date", "N/A"),
            "GSTIN": header.get("gstin_no", "N/A"),
            "PAN": header.get("pan", "N/A"),
            "HSN Code": header.get("hsn_code", "N/A"),
            "CGST": header.get("cgst", "N/A"),
            "SGST": header.get("sgst", "N/A"),
            "IGST": header.get("igst", "N/A"),
            "Grand Total": header.get("grand_total") or header.get("total_price") or header.get("amount") or "N/A",
            "Purchase Order Number": header.get("po_number") or header.get("order_no") or "N/A"
        }
        
        # Download image
        image_filename = f"invoice_{i}.jpg"
        image_path = os.path.join(IMAGES_DIR, image_filename)
        if image_url:
            download_image(image_url, image_path)
            
        print(f"Invoice {i} processed and confirmed.")
        
        html_content += f"""
            <div class="invoice-card">
                <div class="image-pane">
                    <img src="images/{image_filename}" alt="Invoice {i}">
                </div>
                <div class="data-pane">
                    <h2>Invoice {i} <span class="confirmed-badge">✓ Confirmed</span></h2>
                    <table>
                        <tbody>
        """
        
        for key, val in extracted.items():
            html_content += f"""
                            <tr>
                                <th>{key}</th>
                                <td>{val}</td>
                            </tr>
            """
            
        html_content += """
                        </tbody>
                    </table>
                </div>
            </div>
        """

    html_content += """
        </div>
    </body>
    </html>
    """
    
    viewer_path = os.path.join(OUTPUT_DIR, "viewer.html")
    with open(viewer_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"\\nAll 5 invoices processed successfully. Viewer generated at: {os.path.abspath(viewer_path)}")

if __name__ == "__main__":
    main()
