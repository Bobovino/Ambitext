# Document-translator

Para cambiar de dev a prod se cambia .env LIMITED_MODE=false o true

# EASYNMT:

## Opción 1: Sin modelos pre-descargados (más lento la primera vez)

```bash
docker run -p 24080:80 easynmt/api:2.0.2-cpu
```

## Opción 2: Con modelos pre-descargados (recomendado)

```bash
# Crear directorio para modelos (solo la primera vez)
mkdir -p ./easynmt-models

# Pre-descargar modelos (solo la primera vez)
docker run -it --rm \
  -v $(pwd)/easynmt-models:/cache \
  -e TRANSFORMERS_CACHE=/cache \
  easynmt/api:2.0.2-cpu python3 -c "
import easynmt
import os
os.environ['TRANSFORMERS_CACHE'] = '/cache'
model = easynmt.EasyNMT('opus-mt')
# Pre-descargar modelos comunes
model.translate('Hola', source_lang='es', target_lang='de')
model.translate('Hello', source_lang='en', target_lang='es')
print('Models downloaded successfully!')
"

# Ejecutar con modelos pre-descargados
docker run -p 24080:80 \
  -v $(pwd)/easynmt-models:/cache \
  -e TRANSFORMERS_CACHE=/cache \
  easynmt/api:2.0.2-cpu
```

# Para pasar de epub/mobi a pdf

ebook-convert input.epub output.pdf
ebook-convert input.mobi output.pdf

# Recomendable pasar los libros por OCR antes de traducirlos.

sudo apt install tesseract-ocr-deu
ocrmypdf --force-ocr -l deu 'Origen.pdf' 'Destino_OCR.pdf'

# Comenzar el servidor

pnpm run dev

# Para traducir varios libros a la vez

Ejecutar OJO A LOS IDIOMAS!!!!!!!!
python/uv run translate_batch.py
