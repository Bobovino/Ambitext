# Document-translator

Para cambiar de dev a prod se cambia .env LIMITED_MODE=false o true

# Recomendable pasar los libros por OCR antes de traducirlos.

sudo apt install tesseract-ocr-deu
ocrmypdf --force-ocr -l deu 'Origen.pdf' 'Destino_OCR.pdf'

# Caso EASYNMT:

Encender con docker run -p 24080:80 easynmt/api:2.0.2-cpu

# Caso HF

Recomendable iniciar el HF endpoint a mano
