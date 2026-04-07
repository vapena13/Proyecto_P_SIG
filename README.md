# Detección de áreas inundadas mediante Sentinel-1 y Random Forest

Análisis espacial de un evento reciente de inundación en la Subzona Hidrográfica del Bajo Sinú (Córdoba, Colombia) usando imágenes SAR de Sentinel-1 y clasificación supervisada con Random Forest.

## Contenido del repositorio

```
Proyecto_final/
├── proyecto_final.qmd          # Documento principal en Quarto
├── proyecto_final.html          # Salida renderizada en HTML
├── proyecto_final.pdf           # Salida renderizada en PDF
├── referencias.bib              # Bibliografía en formato BibTeX
├── apa.csl                       # Estilo de citas APA
│
├── data/
│   └── vector/
│       ├── raw/                 # Datos originales (shapefiles, etc.)
│       └── processed/           # Datos procesados (GeoJSON, etc.)
│
├── scripts/
│   └── shp_to_geojson.py       # Conversión de formatos espaciales
│
└── README.md                    # Este archivo
```

## Descripción del proyecto

**Objetivo:** Analizar la distribución espacial de áreas inundadas en un evento reciente de la Subzona Hidrográfica del Bajo Sinú mediante imágenes Sentinel-1 SAR y un modelo Random Forest, implementando un flujo reproducible en Google Earth Engine y Python.

**Área de estudio:** Subzona Hidrográfica del Bajo Sinú, departamento de Córdoba, Colombia. Ubicada en el tramo inferior de la cuenca del río Sinú, caracterizada por planicies aluviales propensas a inundaciones.

**Metodología en 5 fases:**
1. Delimitación y preparación del área de estudio
2. Consulta y selección de imágenes Sentinel-1
3. Construcción de variables y muestras de entrenamiento
4. Clasificación con Random Forest y evaluación
5. Generación de productos cartográficos

## Requisitos

### Python y librerías

- Python 3.8+
- `earthengine-api`: Acceso a Google Earth Engine
- `geemap`: Visualización e integración con GEE
- `geopandas`: Manipulación de datos vectoriales
- `pandas`, `numpy`: Análisis de datos
- `matplotlib`: Visualización
- `rasterio`: Manejo de ráster
- `scikit-learn`: Algoritmo Random Forest

### Otros requisitos

- Quarto (>= 1.3): Para renderizar .qmd
- TeX Live (pdflatex): Para generar PDF
- Acceso a Google Earth Engine

### Instalación de dependencias

```bash
# Crear entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar paquetes
pip install -r requirements.txt
```

## Uso

### Renderizar el documento

Para generar HTML y PDF:

```bash
cd Proyecto_final
quarto render proyecto_final.qmd
```

Solo HTML:
```bash
quarto render proyecto_final.qmd --to html
```

Solo PDF:
```bash
quarto render proyecto_final.qmd --to pdf
```

### Procesar datos vectoriales

Convertir shapefiles a GeoJSON:

```bash
python scripts/shp_to_geojson.py
```

## Datos utilizados

- **Imágenes principales:** Colección Sentinel-1 SAR GRD en Google Earth Engine
- **Delimitación:** Subzona Hidrográfica del Bajo Sinú (formato vectorial convertido a GeoJSON)
- **Capas auxiliares:** Modelo digital de elevación, pendientes, cuerpos de agua permanentes
- **Fuentes:** IDEAM, IGAC, DANE, HydroSHEDS, Google Earth Engine

## Flujo de trabajo

El análisis se implementa en un flujo reproducible que integra:

1. **Google Earth Engine:** Consulta, filtrado y visualización de imágenes Sentinel-1
2. **Python + GeoPandas:** Preparación de datos vectoriales y capas auxiliares
3. **Scikit-learn:** Entrenamiento y evaluación del modelo Random Forest
4. **Quarto:** Documentación y generación de reportes finales (HTML/PDF)

## Reproducibilidad

- Todo el código está documentado en el archivo `.qmd`
- Los scripts en la carpeta `scripts/` pueden ejecutarse independientemente
- Los datos se gestionar de forma versionable (formatos abiertos: GeoJSON, CSV)
- Salidas en múltiples formatos (HTML, PDF, mapas)

## Autor

Viviana Andrea Peña González  
Maestría en Geomática, Universidad Nacional de Colombia  
Asignatura: Programación SIG  
Docente: Alexys Herleym Rodríguez Avellaneda

## Referencias

Ver `referencias.bib` para la bibliografía completa citada en el documento.

## Licencia

Este proyecto es de código abierto y se distribuye bajo principios de ciencia abierta.
