import sys
try:
    from datasets import load_dataset
except ImportError:
    print("datasets not installed")
    sys.exit(1)

try:
    ds = load_dataset("AjitRawat/invoice", split="train")
    print(ds.column_names)
    print(ds[0])
except Exception as e:
    print(f"Error loading dataset: {e}")
