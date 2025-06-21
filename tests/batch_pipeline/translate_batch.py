import os
import requests
import subprocess
import tempfile

SOURCE_LANG = "en"
SOURCE_OCR_LANG = "eng"  # Tesseract code for OCR
TARGET_LANG = "es"
TARGET_OCR_LANG = "spa"
API_URL = "http://localhost:3000/api/translate"

INPUT_DIR = "./pdfs_a_traducir"
OUTPUT_DIR = "./pdfs_traducidos"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def convert_to_pdf(input_path):
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".pdf":
        return input_path, False  # Already PDF, not temporary
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
        temp_pdf_path = temp_pdf.name
    try:
        subprocess.run(
            ["ebook-convert", input_path, temp_pdf_path],
            check=True
        )
        print(f"Convertido a PDF: {temp_pdf_path}")
        return temp_pdf_path, True  # Temporary PDF created
    except subprocess.CalledProcessError as e:
        print(f"Error convirtiendo {input_path} a PDF: {e}")
        os.remove(temp_pdf_path)
        return None, False


for filename in os.listdir(INPUT_DIR):
    if not (filename.lower().endswith(".pdf") or filename.lower().endswith(".epub") or filename.lower().endswith(".mobi")):
        continue
    filepath = os.path.join(INPUT_DIR, filename)
    print(f"Procesando archivo: {filename}")

    # Convertir a PDF si es necesario
    pdf_path, is_temp_pdf = convert_to_pdf(filepath)
    if not pdf_path:
        continue

    # Crear archivo temporal para el PDF con OCR
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_ocr:
        temp_ocr_path = temp_ocr.name

    # Ejecutar OCR
    try:
        subprocess.run(
            ["ocrmypdf", "--force-ocr", "-l",
                SOURCE_OCR_LANG, pdf_path, temp_ocr_path],
            check=True
        )
        print(f"OCR completado: {temp_ocr_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error en OCR para {filename}: {e}")
        os.remove(temp_ocr_path)
        if is_temp_pdf:
            os.remove(pdf_path)
        continue

    print(f"Traduciendo: {filename}")
    with open(temp_ocr_path, "rb") as f:
        files = {"pdfFile": (os.path.splitext(filename)[
                             0] + ".pdf", f, "application/pdf")}
        data = {
            "sourceLang": SOURCE_LANG,
            "targetLang": TARGET_LANG,
            "sessionId": filename
        }
        print(f"Enviando datos: {data}")
        resp = requests.post(API_URL, files=files, data=data)
        if resp.status_code == 200:
            outname = f"{os.path.splitext(filename)[0]}_{SOURCE_LANG}_a_{TARGET_LANG}.pdf"
            outpath = os.path.join(OUTPUT_DIR, outname)
            with open(outpath, "wb") as out:
                out.write(resp.content)
            print(f"Guardado: {outpath}")
        else:
            print(
                f"Error traduciendo {filename}: {resp.status_code} {resp.text}")

    # Limpiar archivos temporales
    os.remove(temp_ocr_path)
    if is_temp_pdf:
        os.remove(pdf_path)
