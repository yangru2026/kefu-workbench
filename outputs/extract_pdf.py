import pdfplumber

PDF = r"C:\Users\Administrator\Downloads\极氧品牌 .pdf"
OUT = r"C:\Users\Administrator\WorkBuddy\2026-07-28-10-50-05\outputs\jiyang_pdf.txt"

with pdfplumber.open(PDF) as pdf:
    lines = []
    for i, page in enumerate(pdf.pages):
        lines.append(f"\n===== PAGE {i+1} =====\n")
        txt = page.extract_text() or ""
        lines.append(txt)
        # 也提取表格
        tables = page.extract_tables()
        for t in tables:
            lines.append("\n[TABLE]\n")
            for row in t:
                lines.append(" | ".join(str(c) if c is not None else "" for c in row))
            lines.append("\n[/TABLE]\n")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("saved", OUT, "pages:", len(pdf.pages))
