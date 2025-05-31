import os
import requests
import subprocess
import tempfile
import shutil

SOURCE_LANG = "es"
TARGET_LANG = "de"
API_URL = "http://localhost:3000/api/translate"

INPUT_DIR = "./pdfs_a_traducir"
OUTPUT_DIR = "./pdfs_traducidos"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for filename in os.listdir(INPUT_DIR):
    if not filename.lower().endswith(".pdf"):
        continue
    filepath = os.path.join(INPUT_DIR, filename)
    print(f"Procesando OCR: {filename}")

    # Crear archivo temporal para el PDF con OCR
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_ocr:
        temp_ocr_path = temp_ocr.name

    # Ejecutar OCR
    try:
        subprocess.run(
            ["ocrmypdf", "--force-ocr", "-l", SOURCE_LANG, filepath, temp_ocr_path],
            check=True
        )
        print(f"OCR completado: {temp_ocr_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error en OCR para {filename}: {e}")
        # Limpiar archivo temporal
        os.remove(temp_ocr_path)
        continue

    print(f"Traduciendo: {filename}")
    with open(temp_ocr_path, "rb") as f:
        files = {"pdfFile": (filename, f, "application/pdf")}
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

    # Limpiar archivo temporal
    os.remove(temp_ocr_path)
