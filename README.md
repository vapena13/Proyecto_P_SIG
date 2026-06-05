# Detección de áreas inundadas en el Bajo Sinú

Proyecto final de **Programación SIG**. El repositorio implementa un flujo reproducible para detectar áreas probablemente inundadas en la Subzona Hidrográfica del Bajo Sinú, Colombia, usando Sentinel-1 SAR, OPERA DSWx-S1, NASADEM, JRC Global Surface Water y Random Forest.

El flujo principal se ejecuta en Google Earth Engine. El postproceso, la generación de figuras y la verificación local del modelo se realizan en Python; Julia se usa como resumen tabular complementario. También se incluyen plantillas para Earth Engine Apps y un script auxiliar para cargar capas desde QGIS con GEE Data Catalog.

## Estructura

```text
.
|-- proyecto_final.qmd
|-- proyecto_final.html
|-- proyecto_final.pdf
|-- referencias.bib
|-- apa.csl
|-- styles.css
|-- requirements.txt
|-- docker/
|   `-- Dockerfile
|-- docker-compose.project.yml
|-- docker-compose.local.yml
|-- config/
|   `-- project_config.example.json
|-- data/
|   |-- vector/raw/
|   `-- vector/processed/
|-- docs/
|   |-- flujo_ejecucion.md
|   `-- nota_metodologica_inundacion_temporal.md
|-- outputs/
|   |-- rf/
|   |-- tables/
|   `-- figures/
|-- scripts/
|   |-- gee/
|   |-- julia/
|   |-- python/
|   |-- qgis/
|   `-- shp_to_geojson.py
`-- proyecto_final_files/
```

Las carpetas `maps/`, `no/`, `.quarto/`, archivos temporales de LaTeX, credenciales y documentos preliminares quedan fuera del control de versiones mediante `.gitignore`.

## Entorno reproducible

La forma recomendada para reproducir el proyecto fuera del contenedor de clase es construir el Docker propio:

```bash
docker compose -f docker-compose.project.yml up --build
```

El servicio abre Jupyter Lab en:

```text
http://127.0.0.1:8890
```

Entrar al contenedor:

```bash
docker exec -it bajo_sinu_proyecto_final bash
```

Verificar entorno:

```bash
cd /workspace
python3 scripts/python/00_check_environment.py
```

Como respaldo, si existe la imagen local de clase `image_sig_unal:final`, se puede usar:

```bash
docker compose -f docker-compose.local.yml up -d
docker exec -it bajo_sinu_proyecto_local bash
```

## Flujo de ejecución

1. Ejecutar el flujo principal en Google Earth Engine:

```text
scripts/gee/01_bajo_sinu_flood_rf.js
```

2. Exportar a Google Drive los productos generados y descargarlos en:

```text
outputs/rf/
```

3. Ejecutar postproceso en Python:

```bash
python3 scripts/python/02_postprocess_metrics.py
```

4. Reproducir el Random Forest local con Python:

```bash
python3 scripts/python/03_rf_local_sklearn.py
```

5. Generar resumen tabular en Julia:

```bash
julia scripts/julia/04_postprocess_summary.jl
```

6. Renderizar el informe:

```bash
quarto render proyecto_final.qmd --to html
quarto render proyecto_final.qmd --to pdf
```

## Productos

- Máscara de inundación temporal clasificada.
- Ráster de severidad relativa morfométrica.
- Área inundada total.
- Área inundada por rangos de elevación.
- Área inundada por rangos de pendiente.
- Métricas del modelo Random Forest.
- Comparación GEE/Python y resumen Julia.
- Figuras y mapas derivados en `outputs/figures/`.
- Plantilla de visor GEE App y app interactiva.
- Script auxiliar para cargar capas en QGIS mediante GEE Data Catalog.

## Scripts principales

- `scripts/gee/01_bajo_sinu_flood_rf.js`: flujo principal en Earth Engine.
- `scripts/gee/02_bajo_sinu_app_template.js`: visor simple de resultados.
- `scripts/gee/03_bajo_sinu_interactive_app.js`: app exploratoria con AOI y fechas editables.
- `scripts/python/02_postprocess_metrics.py`: tablas limpias y figuras derivadas.
- `scripts/python/03_rf_local_sklearn.py`: verificación local del Random Forest.
- `scripts/julia/04_postprocess_summary.jl`: resumen tabular complementario.
- `scripts/qgis/gee_data_catalog_quick_layers.py`: capas rápidas para QGIS/GEE Data Catalog.

## Dependencias

El entorno reproducible recomendado es Docker. El archivo `requirements.txt` se mantiene como referencia para una instalación local de Python, con versiones fijadas según el entorno verificado del proyecto. Para evitar diferencias entre sistemas operativos, la revisión principal debe hacerse mediante `docker-compose.project.yml`.

## Credenciales

No se versionan credenciales reales. Cualquier archivo local sensible debe guardarse en rutas ignoradas por git, como:

```text
credentials/
config/project_config.json
```

El archivo versionado `config/project_config.example.json` funciona solo como plantilla.

## Autora

Viviana Andrea Peña González  
Universidad Nacional de Colombia  
Maestría en Geomática  
Asignatura: Programación SIG
