# Vendor Parser Files

Cadence uses local parser scripts for text-only book/document import:

- `jszip.min.js` for EPUB ZIP package reading
- `pdf.min.js` and `pdf.worker.min.js` for selectable PDF text extraction

These files are intentionally local so the reader can remain static and avoid runtime CDN dependency.

Expected sources:

- JSZip: https://jszip.org/
- PDF.js / `pdfjs-dist`: https://mozilla.github.io/pdf.js/getting_started/

Import scope:

- EPUB: extract readable XHTML/HTML text only
- PDF: extract selectable embedded text only
- OCR, scanned PDFs, image-only PDFs, and layout preservation are out of scope
