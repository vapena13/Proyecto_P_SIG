# Detección de áreas inundadas mediante imágenes Sentinel-1 y clasificación Random Forest en la Subzona Hidrográfica del Bajo Sinú, Colombia

Este repositorio contiene el proyecto final de la asignatura **Programación SIG**. El trabajo analiza la detección de áreas inundadas asociadas a un evento reciente en la **Subzona Hidrográfica del Bajo Sinú** mediante imágenes **Sentinel-1 SAR** y un clasificador **Random Forest**, implementando un flujo reproducible en **Google Earth Engine** y **Python**.

## Estructura del repositorio

```text
.
├── README.md
├── .gitignore
├── proyecto_final.qmd
├── proyecto_final.pdf
├── apa.csl
├── referencias.bib
├── bibliografia/
├── proyecto_final_files/
├── scripts/
└── outputs/

```

## Descripción de carpetas y archivos

- `proyecto_final.qmd`: Documento fuente en Quarto (contiene texto, código y referencias).
- `proyecto_final.html`: Versión renderizada en HTML.
- `proyecto_final.pdf`: Versión renderizada en PDF.
- `referencias.bib`: Base bibliográfica en formato BibTeX.
- `apa.csl`: Estilo de citación APA.
- `scripts/`: Scripts de Python para procesamiento de datos (ej. conversión de formatos).
- `data/`: Datos vectoriales (raw y processed).
- `outputs/`: Mapas, tablas y productos derivados del análisis.

## Datos utilizados

- **Imágenes principales:** Colección Sentinel-1 SAR GRD en Google Earth Engine (polarizaciones VV/VH).
- **Delimitación:** Subzona Hidrográfica del Bajo Sinú (formato vectorial convertido a GeoJSON).
- **Capas auxiliares:** Modelo digital de elevación, pendientes, cuerpos de agua permanentes.
- **Fuentes:** IDEAM, IGAC, DANE, HydroSHEDS, Google Earth Engine.


## Requisitos e instalación

### Dependencias

- Python 3.8+
- Quarto (>= 1.3)
- TeX Live (pdflatex) para generar PDF
- Google Earth Engine (acceso a https://earthengine.google.com)

### Paquetes Python

```bash
earthengine-api
geemap
geopandas
pandas
numpy
matplotlib
rasterio
scikit-learn
```

### Instalación

```bash
# Clonar o descargar el repositorio
cd Proyecto_final

# Crear entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt  # Si existe, o instalar manualmente
pip install earthengine-api geemap geopandas pandas numpy matplotlib rasterio scikit-learn
```

## Cómo usar

.
.
.



Autora

Viviana Andrea Peña González

Contexto académico

Universidad Nacional de Colombia
Maestría en Geomática
Asignatura: Programación SIG
Docente: Alexys Herleym Rodríguez Avellaneda