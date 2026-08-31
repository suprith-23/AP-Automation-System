import re
import unicodedata
from typing import List
from app.ai.ocr.models import OCRBlock

class Stage1Cleaner:
    """
    Cleans raw OCR output before extraction.
    Removes duplicate lines, artifacts, page numbers, repeated headers/footers.
    Normalizes whitespace and Unicode while attempting to preserve table alignment.
    """
    
    @staticmethod
    def normalize_unicode(text: str) -> str:
        """Normalize unicode characters (e.g. smart quotes, em dashes)."""
        if not text:
            return text
        # NFKC normalization replaces compatibility characters with their equivalents
        normalized = unicodedata.normalize('NFKC', text)
        return normalized

    @staticmethod
    def remove_artifacts(text: str) -> str:
        """Remove common OCR artifacts but keep typical invoice characters."""
        # This regex removes non-printable or highly unusual characters,
        # but keeps letters, digits, punctuation, and common symbols.
        # We also keep whitespace (tabs, newlines, spaces).
        # We can be conservative here to not destroy valid data.
        cleaned = re.sub(r'[^\x20-\x7E\t\n\r\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u20AC\u00A3\u20B9]+', '', text)
        return cleaned

    @staticmethod
    def is_page_number(line: str) -> bool:
        """Detect if a line is just a page number, e.g. 'Page 1 of 2'."""
        line = line.strip().lower()
        if re.match(r'^page\s+\d+(\s+(of|/)\s+\d+)?$', line):
            return True
        if re.match(r'^\d+\s+(of|/)\s+\d+$', line):
            return True
        return False

    @staticmethod
    def clean_text(raw_text: str, blocks: List['OCRBlock'] = None) -> tuple[str, List['OCRBlock']]:
        """Main entry point to clean the raw OCR text and blocks."""
        if not raw_text:
            return "", []

        # Clean raw text
        text = Stage1Cleaner.normalize_unicode(raw_text)
        text = Stage1Cleaner.remove_artifacts(text)
        # Escape curly braces to prevent prompt formatting/injection attacks
        text = text.replace("{", "[").replace("}", "]")

        lines = text.split('\n')
        cleaned_lines = []
        seen_lines = set()

        for line in lines:
            stripped_line = line.strip()
            if not stripped_line:
                continue
            if Stage1Cleaner.is_page_number(stripped_line):
                continue

            line_normalized_spacing = re.sub(r' {3,}', ' \t ', line).strip()
            if len(stripped_line) > 10:
                if stripped_line in seen_lines:
                    continue
                seen_lines.add(stripped_line)
            cleaned_lines.append(line_normalized_spacing)
            
        cleaned_text = '\n'.join(cleaned_lines)
        
        # Clean blocks
        cleaned_blocks = []
        if blocks:
            for block in blocks:
                # 1. Normalize
                b_text = Stage1Cleaner.normalize_unicode(block.text)
                b_text = Stage1Cleaner.remove_artifacts(b_text).strip()
                b_text = b_text.replace("{", "[").replace("}", "]")
                
                # 2. Filter out page numbers or empty blocks
                if not b_text or Stage1Cleaner.is_page_number(b_text):
                    continue
                    
                block.text = b_text
                cleaned_blocks.append(block)

        return cleaned_text, cleaned_blocks
