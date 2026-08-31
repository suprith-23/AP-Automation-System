import re
from typing import List, Dict, Any
from app.ai.ocr.models import OCRBlock

class Stage4Table:
    """
    Recovers line-item tables from OCR text.
    Uses basic heuristics to parse columns, merge wrapped rows, and extract quantities/prices.
    """

    @staticmethod
    def _parse_level_1_geometry(blocks: List[OCRBlock]) -> List[Dict[str, Any]]:
        """Level 1: Geometry-based table parsing using bounding boxes."""
        # Filter blocks that might be in a table
        # We group by Y coordinate (using some tolerance, e.g., 10 pixels)
        rows_by_y = []
        tolerance = 15
        
        for block in blocks:
            if not block.box or len(block.box) < 4:
                continue
            # Y coordinate of top-left corner
            y_coord = block.box[0][1]
            
            # Find an existing row within tolerance
            matched_row = None
            for row in rows_by_y:
                if abs(row['y'] - y_coord) < tolerance:
                    matched_row = row
                    break
                    
            if matched_row:
                matched_row['blocks'].append(block)
                # update average y
                matched_row['y'] = sum(b.box[0][1] for b in matched_row['blocks']) / len(matched_row['blocks'])
            else:
                rows_by_y.append({'y': y_coord, 'blocks': [block]})
                
        # Sort rows by Y
        rows_by_y.sort(key=lambda r: r['y'])
        
        # Sort blocks in each row by X
        for row in rows_by_y:
            row['blocks'].sort(key=lambda b: b.box[0][0])
            
        # Find header row
        header_idx = -1
        for idx, row in enumerate(rows_by_y):
            row_text = " ".join([b.text.lower() for b in row['blocks']])
            if "qty" in row_text or "quantity" in row_text or "amount" in row_text or "price" in row_text or "description" in row_text:
                header_idx = idx
                break
                
        if header_idx == -1:
            return []
            
        headers = [b.text.lower().replace(" ", "_").strip() for b in rows_by_y[header_idx]['blocks']]
        
        parsed_rows = []
        for idx in range(header_idx + 1, len(rows_by_y)):
            row = rows_by_y[idx]
            row_blocks = row['blocks']
            if len(row_blocks) <= 1:
                # likely a continuation
                if parsed_rows and len(row_blocks) == 1:
                    prev_row = parsed_rows[-1]
                    # Append to longest string column
                    desc_key = None
                    max_len = 0
                    for k, v in prev_row.items():
                        if isinstance(v, str) and len(v) > max_len and not re.match(r'^[\d\.]+$', v):
                            max_len = len(v)
                            desc_key = k
                    if desc_key:
                        prev_row[desc_key] += " " + row_blocks[0].text
                continue
                
            row_data = {}
            for c_idx, block in enumerate(row_blocks):
                if c_idx < len(headers):
                    key = headers[c_idx]
                else:
                    key = f"col_{c_idx}"
                row_data[key] = block.text
            parsed_rows.append(row_data)
            
        return parsed_rows

    @staticmethod
    def _parse_level_2_delimiter(line_items_text: str) -> List[Dict[str, Any]]:
        """Level 2: Delimiter-based fallback using 2+ spaces or tabs."""
        lines = line_items_text.strip().split('\n')
        if not lines:
            return []

        rows = []
        headers = []

        header_idx = -1
        for idx, line in enumerate(lines):
            line_lower = line.lower()
            if "qty" in line_lower or "quantity" in line_lower or "amount" in line_lower or "price" in line_lower or "description" in line_lower:
                headers = re.split(r'\s{2,}|\t', line.strip())
                header_idx = idx
                break

        if header_idx == -1:
            return []

        for idx in range(header_idx + 1, len(lines)):
            line = lines[idx].strip()
            if not line:
                continue
                
            cols = re.split(r'\s{2,}|\t', line)
            
            if len(cols) == 1 and rows:
                prev_row = rows[-1]
                desc_key = None
                max_len = 0
                for k, v in prev_row.items():
                    if isinstance(v, str) and len(v) > max_len and not re.match(r'^[\d\.]+$', v):
                        max_len = len(v)
                        desc_key = k
                
                if desc_key:
                    prev_row[desc_key] += " " + cols[0]
                continue

            row_data = {}
            for c_idx, col_val in enumerate(cols):
                if c_idx < len(headers):
                    key = headers[c_idx].lower().replace(" ", "_").strip()
                else:
                    key = f"col_{c_idx}"
                row_data[key] = col_val.strip()
                
            rows.append(row_data)

        return rows

    @staticmethod
    def _parse_level_3_heuristic(line_items_text: str) -> List[Dict[str, Any]]:
        """Level 3: Heuristic parser based on numeric alignments."""
        # This is a basic fallback that just grabs lines ending with decimals
        lines = line_items_text.strip().split('\n')
        rows = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # if line ends with a number (like price/amount)
            if re.search(r'\d[\d,\.]*$', line):
                parts = line.rsplit(' ', 1)
                if len(parts) == 2:
                    rows.append({
                        "description": parts[0],
                        "amount": parts[1]
                    })
        return rows

    @staticmethod
    def extract_table(line_items_text: str, blocks: List[OCRBlock] = None) -> List[Dict[str, Any]]:
        """
        Extracts table using multi-level strategies.
        Selects the best result automatically.
        """
        if not line_items_text and not blocks:
            return []

        rows = []
        
        # Level 1: Geometry
        if blocks:
            # We filter blocks that belong to the line_items section.
            # For simplicity, we pass all blocks, but in reality we'd intersect with layout text.
            rows = Stage4Table._parse_level_1_geometry(blocks)
            
        # Level 2: Delimiter
        if not rows and line_items_text:
            rows = Stage4Table._parse_level_2_delimiter(line_items_text)
            
        # Level 3: Heuristic
        if not rows and line_items_text:
            rows = Stage4Table._parse_level_3_heuristic(line_items_text)
            
        return rows
