# Document-translator

Para cambiar de dev a prod se cambia .env LIMITED_MODE=false o true

# EASYNMT:

Encender con docker run -p 24080:80 easynmt/api:2.0.2-cpu

# Para pasar de epub/mobi a pdf

ebook-convert input.epub output.pdf
ebook-convert input.mobi output.pdf

# Recomendable pasar los libros por OCR antes de traducirlos.

sudo apt install tesseract-ocr-deu
ocrmypdf --force-ocr -l deu 'Origen.pdf' 'Destino_OCR.pdf'
