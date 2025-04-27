import os
import requests

SOURCE_LANG = "de"
TARGET_LANG = "es"
# Cambia el puerto si es necesario
API_URL = "http://localhost:3000/api/translate"

INPUT_DIR = "./pdfs_a_traducir"
OUTPUT_DIR = "./pdfs_traducidos"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for filename in os.listdir(INPUT_DIR):
    if not filename.lower().endswith(".pdf"):
        continue
    filepath = os.path.join(INPUT_DIR, filename)
    print(f"Traduciendo: {filename}")
    with open(filepath, "rb") as f:
        files = {"pdfFile": (filename, f, "application/pdf")}
        data = {
            "sourceLang": SOURCE_LANG,
            "targetLang": TARGET_LANG,
            "sessionId": filename  # Puedes usar el nombre como sessionId
        }
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
