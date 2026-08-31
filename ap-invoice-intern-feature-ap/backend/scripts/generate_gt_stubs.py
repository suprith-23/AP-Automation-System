import os
import json
from pathlib import Path

# 1. Define paths relative to this script
BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "tests" / "benchmark_dataset" / "images"
GT_DIR = BASE_DIR / "tests" / "benchmark_dataset" / "ground_truth"

# 2. This is the exact schema the AI is expected to return.
# We set everything to None by default.
EMPTY_SCHEMA = {
  "type_of_invoice": None,
  "irn": None,
  "po_number": None,
  "invoice_number": None,
  "invoice_date": None,
  "seller_name": None,
  "seller_gstin": None,
  "seller_gstin_pincode": None,
  "buyer_name": None,
  "buyer_gstin": None,
  "buyer_gstin_pincode": None,
  "shipping_gstin": None,
  "shipping_gstin_pincode": None,
  "currency": None,
  "total_taxable_value": None,
  "total_gst_rate": None,
  "total_cgst_value": None,
  "total_sgst_value": None,
  "total_igst_value": None,
  "total_ces_value": None,
  "total_st_ces_value": None,
  "total_discount_value": None,
  "round_off_amount": None,
  "total_accessment_value": None,
  "total_invoice_value": None,
  "items": [
    {
      "item_number": None,
      "sl_no": None,
      "is_service": None,
      "description": None,
      "hsn_code": None,
      "quantity": None,
      "unit": None,
      "unit_price": None,
      "total_amount": None,
      "discount": None,
      "assessable_value": None,
      "gst_rate": None,
      "igst_amount": None,
      "cgst_amount": None,
      "sgst_amount": None,
      "cess_rate": None,
      "cess_amount": None,
      "cess_non_advalorem_amount": None,
      "state_cess_rate": None,
      "state_cess_amount": None,
      "other_charges": None,
      "total_item_value": None
    }
  ],
  "confidence": {
    "type_of_invoice": None,
    "irn": None,
    "po_number": None,
    "invoice_number": None,
    "invoice_date": None,
    "seller_name": None,
    "seller_gstin": None,
    "seller_gstin_pincode": None,
    "buyer_name": None,
    "buyer_gstin": None,
    "buyer_gstin_pincode": None,
    "shipping_gstin": None,
    "shipping_gstin_pincode": None,
    "currency": None,
    "total_taxable_value": None,
    "total_gst_rate": None,
    "total_cgst_value": None,
    "total_sgst_value": None,
    "total_igst_value": None,
    "total_ces_value": None,
    "total_st_ces_value": None,
    "total_discount_value": None,
    "round_off_amount": None,
    "total_accessment_value": None,
    "total_invoice_value": None,
    "items": [
      {
        "item_number": None,
        "sl_no": None,
        "is_service": None,
        "description": None,
        "hsn_code": None,
        "quantity": None,
        "unit": None,
        "unit_price": None,
        "total_amount": None,
        "discount": None,
        "assessable_value": None,
        "gst_rate": None,
        "igst_amount": None,
        "cgst_amount": None,
        "sgst_amount": None,
        "cess_rate": None,
        "cess_amount": None,
        "cess_non_advalorem_amount": None,
        "state_cess_rate": None,
        "state_cess_amount": None,
        "other_charges": None,
        "total_item_value": None
      }
    ]
  }
}
def generate_stubs():
    # 3. Iterate over every file in the images directory
    for filename in os.listdir(IMAGES_DIR):
        if filename.startswith("."):
            continue # Skip hidden files
            
        # 4. Change the extension from .pdf/.jpg to .json
        base_name = os.path.splitext(filename)[0]
        json_filename = f"{base_name}.json"
        json_path = GT_DIR / json_filename
        
        # 5. If the JSON doesn't already exist, create it
        if not json_path.exists():
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(EMPTY_SCHEMA, f, indent=2)
            print(f"Created stub for {filename} -> {json_filename}")
        else:
            print(f"Skipped {json_filename} (already exists)")

if __name__ == "__main__":
    generate_stubs()
