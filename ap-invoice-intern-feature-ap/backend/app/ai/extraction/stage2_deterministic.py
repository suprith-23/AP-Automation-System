import re
from typing import List, Dict, Any
from app.ai.ocr.models import OCRBlock

class Stage2Deterministic:
    """
    Deterministic extraction engine using Regex and pattern matching.
    Extracts fields that do not require AI reasoning.
    Returns lists of candidates with confidence scores.
    """

    @staticmethod
    def normalize_ocr_text(text: str, field_type: str) -> str:
        """Normalize common OCR mistakes based on field context."""
        if not text:
            return text
            
        if field_type == "invoice_number":
            # For invoice numbers, only replace O/I/l/S/B/Z/A if they appear amid or adjacent to digits
            # E.g., 0I9 -> 019. But INV -> INV.
            
            # Simple heuristic: replace confusable letters if they are preceded or followed by a digit.
            # We'll do this iteratively.
            import re
            
            def replacer(m):
                confusion_map = {'O': '0', 'I': '1', 'l': '1', 'S': '5', 'B': '8', 'Z': '2', 'A': '4'}
                return confusion_map.get(m.group(0), m.group(0))
                
            # Replace confusable chars that are preceded by a digit
            text = re.sub(r'(?<=\d)[OIlSBZA]', replacer, text)
            # Replace confusable chars that are followed by a digit
            text = re.sub(r'[OIlSBZA](?=\d)', replacer, text)
            
            return text
            
        elif field_type in ["gstin_numeric", "pan_numeric"]:
            confusion_map = {'O': '0', 'I': '1', 'l': '1', 'S': '5', 'B': '8', 'Z': '2', 'A': '4'}
            normalized = ""
            for char in text:
                if char in confusion_map:
                    normalized += confusion_map[char]
                else:
                    normalized += char
            return normalized
            
        return text

    @staticmethod
    def extract_gstins(text: str) -> List[Dict[str, Any]]:
        """Extract GSTIN candidates."""
        # Standard GSTIN format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
        pattern = r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})\b'
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        candidates = []
        seen = set()
        for match in matches:
            val = match.group(1).upper()
            
            # Apply targeted normalization for GSTIN format (e.g. middle 4 characters should be numeric)
            part1 = val[:2]
            part2 = val[2:7]
            part3 = val[7:11]
            part4 = val[11:]
            
            part3_norm = "".join([Stage2Deterministic.normalize_ocr_text(c, "gstin_numeric") if c.isalpha() else c for c in part3])
            val_norm = part1 + part2 + part3_norm + part4
            
            if val_norm not in seen:
                candidates.append({
                    "value": val_norm,
                    "confidence": 0.95,
                    "method": "regex_gstin",
                    "original_text": val
                })
                seen.add(val_norm)
        return candidates

    @staticmethod
    def extract_pans(text: str) -> List[Dict[str, Any]]:
        """Extract PAN candidates."""
        # Standard PAN format: 5 letters + 4 digits + 1 letter
        pattern = r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b'
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        candidates = []
        seen = set()
        for match in matches:
            val = match.group(1).upper()
            
            part1 = val[:5]
            part2 = val[5:9]
            part3 = val[9:]
            
            part2_norm = "".join([Stage2Deterministic.normalize_ocr_text(c, "pan_numeric") if c.isalpha() else c for c in part2])
            val_norm = part1 + part2_norm + part3
            
            if val_norm not in seen:
                candidates.append({
                    "value": val_norm,
                    "confidence": 0.90,
                    "method": "regex_pan",
                    "original_text": val
                })
                seen.add(val_norm)
        return candidates

    @staticmethod
    def extract_emails(text: str) -> List[Dict[str, Any]]:
        """Extract email candidates."""
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
        matches = re.finditer(pattern, text)
        
        candidates = []
        seen = set()
        for match in matches:
            val = match.group(0).lower()
            if val not in seen:
                candidates.append({
                    "value": val,
                    "confidence": 0.95,
                    "method": "regex_email"
                })
                seen.add(val)
        return candidates

    @staticmethod
    def extract_dates(text: str) -> List[Dict[str, Any]]:
        """Extract potential dates."""
        # Basic regex for DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
        pattern = r'\b(?:(?:0[1-9]|[12][0-9]|3[01])[/\-\.](?:0[1-9]|1[012])[/\-\.](?:19|20)\d\d|(?:19|20)\d\d[/\-\.](?:0[1-9]|1[012])[/\-\.](?:0[1-9]|[12][0-9]|3[01]))\b'
        matches = re.finditer(pattern, text)
        
        candidates = []
        seen = set()
        for match in matches:
            val = match.group(0)
            if val not in seen:
                # Give higher confidence if preceded by "Date"
                context_start = max(0, match.start() - 20)
                context = text[context_start:match.start()].lower()
                conf = 0.8
                if "date" in context:
                    conf = 0.95
                
                candidates.append({
                    "value": val,
                    "confidence": conf,
                    "method": "regex_date"
                })
                seen.add(val)
        return candidates

    @staticmethod
    def extract_ifsc(text: str) -> List[Dict[str, Any]]:
        """Extract IFSC code candidates."""
        # 4 letters, 0, 6 alphanumeric
        pattern = r'\b([A-Z]{4}0[A-Z0-9]{6})\b'
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        candidates = []
        seen = set()
        for match in matches:
            val = match.group(1).upper()
            if val not in seen:
                candidates.append({
                    "value": val,
                    "confidence": 0.95,
                    "method": "regex_ifsc"
                })
                seen.add(val)
        return candidates

    @staticmethod
    def extract_invoice_numbers(text: str, blocks: List[OCRBlock] = None) -> List[Dict[str, Any]]:
        """Extract potential invoice numbers using multiple strategies."""
        candidates = []
        seen = set()
        
        # Strategy A: Invoice labels
        label_pattern = r'(?i)(?:inv(?:oice)?|bill|tax invoice|reference|ref)[\s\._]*(?:no|num|number|#|:)[\s\.\-]*([A-Z0-9\-\/]{3,20})'
        matches = re.finditer(label_pattern, text)
        for match in matches:
            val = match.group(1).strip()
            val_norm = Stage2Deterministic.normalize_ocr_text(val, "invoice_number")
            if any(c.isdigit() for c in val_norm) and val_norm not in seen:
                candidates.append({
                    "value": val_norm,
                    "confidence": 0.95,
                    "method": "strategy_a_label",
                    "original_text": val
                })
                seen.add(val_norm)
                
        # Strategy B: Context-aware / Standalone identifiers
        # Look for typical formats like XXX-1234 or INV/2023/123
        standalone_pattern = r'\b([A-Z]{2,4}[-/\s]\d{3,8}(?:[-/\s][A-Z0-9]+)?)\b'
        matches = re.finditer(standalone_pattern, text)
        for match in matches:
            val = match.group(1).strip()
            val_norm = Stage2Deterministic.normalize_ocr_text(val, "invoice_number")
            if val_norm not in seen:
                candidates.append({
                    "value": val_norm,
                    "confidence": 0.40,
                    "method": "strategy_b_standalone",
                    "original_text": val
                })
                seen.add(val_norm)
                
        # Strategy C: Spatial context (using blocks)
        if blocks:
            for i, block in enumerate(blocks):
                # If a block says "Invoice No", the next block to the right or below might be the value
                if re.match(r'(?i)^(invoice no|invoice number|bill no)$', block.text.strip()):
                    # Simple heuristic: take the next block if it's nearby
                    if i + 1 < len(blocks):
                        next_block = blocks[i+1]
                        val = next_block.text.strip()
                        if any(c.isdigit() for c in val) and len(val) >= 3:
                            val_norm = Stage2Deterministic.normalize_ocr_text(val, "invoice_number")
                            if val_norm not in seen:
                                candidates.append({
                                    "value": val_norm,
                                    "confidence": 0.90,
                                    "method": "strategy_c_spatial",
                                    "original_text": val
                                })
                                seen.add(val_norm)

        return candidates

    @staticmethod
    def extract_vendor_names(text: str, blocks: List[OCRBlock] = None) -> List[Dict[str, Any]]:
        """Extract potential vendor names using heuristics (Indian context)."""
        candidates = []
        seen = set()
        
        # Strategy A: Explicit Indian Labels
        label_pattern = r'(?i)(?:supplier|seller|bill from|billed by|issued by|company name|party name)[\s\.:-]*([A-Za-z0-9\s\&,\.\'\-]{4,50})'
        matches = re.finditer(label_pattern, text)
        for match in matches:
            val = match.group(1).strip()
            # Clean up common trailing words that might get caught
            val = re.sub(r'(?i)\s+(?:date|invoice|gstin|pan|address).*$', '', val).strip()
            if len(val) >= 4 and val not in seen:
                candidates.append({
                    "value": val,
                    "confidence": 0.85,
                    "method": "strategy_a_vendor_label",
                    "original_text": match.group(0)
                })
                seen.add(val)
                
        # Strategy B: Positional (top-most non-address text)
        if blocks:
            # Sort blocks by y-coordinate (assuming box format [[x1,y1], [x2,y1], [x2,y2], [x1,y2]])
            # Since box is optional, we check if it exists
            sorted_blocks = [b for b in blocks if b.box and len(b.box) == 4]
            # y coordinate is typically b.box[0][1] (top left y)
            sorted_blocks.sort(key=lambda b: b.box[0][1])
            
            for block in sorted_blocks[:10]: # Check first 10 blocks
                val = block.text.strip()
                # Exclude typical header noise like "Tax Invoice", "Original for Recipient"
                if re.match(r'(?i)^(tax invoice|invoice|original for recipient|duplicate|triplicate|page \d+)', val):
                    continue
                # Needs to look like a company name (words, some caps)
                if len(val) >= 4 and any(c.isupper() for c in val):
                    if val not in seen:
                        candidates.append({
                            "value": val,
                            "confidence": 0.70,
                            "method": "strategy_b_positional",
                            "original_text": val
                        })
                        seen.add(val)
                    break # Take the first matching one as positional heuristic

        return candidates

    @staticmethod
    def extract_all(text: str, blocks: List[OCRBlock] = None) -> Dict[str, List[Dict[str, Any]]]:
        """Run all deterministic extractors."""
        return {
            "gstins": Stage2Deterministic.extract_gstins(text),
            "pans": Stage2Deterministic.extract_pans(text),
            "emails": Stage2Deterministic.extract_emails(text),
            "dates": Stage2Deterministic.extract_dates(text),
            "ifscs": Stage2Deterministic.extract_ifsc(text),
            "invoice_numbers": Stage2Deterministic.extract_invoice_numbers(text, blocks),
            "vendor_names": Stage2Deterministic.extract_vendor_names(text, blocks),
            # Other fields like Amounts, POs, etc., can be added here
        }
