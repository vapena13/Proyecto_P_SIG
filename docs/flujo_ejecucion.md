# Flujo de ejecucion

Este proyecto se ejecuta en tres bloques: Google Earth Engine, Python y Quarto.

## 0. Entorno reproducible

Hay dos formas de trabajar el entorno. La opcion recomendada para reproducir el proyecto fuera del contenedor de clase es el Docker propio del repositorio.

### Opcion A: Docker propio del proyecto

Desde la raiz de `Proyecto_final`:

```bash
docker compose -f docker-compose.project.yml up --build
```

El servicio abre Jupyter Lab en:

```text
http://127.0.0.1:8890
```

El entorno propio se define en:

- `docker/Dockerfile`
- `docker-compose.project.yml`
- `requirements.txt`

Incluye Python, Quarto, LaTeX, GDAL, librerias geoespaciales de Python y Julia con los paquetes necesarios para el resumen tabular.

Para verificar paquetes dentro del contenedor:

```bash
python3 scripts/python/00_check_environment.py
julia scripts/julia/04_postprocess_summary.jl
```

Las credenciales reales no se versionan. Si se requiere un archivo local, debe quedar en una ruta ignorada por git, por ejemplo `config/project_config.json` o `credentials/`.

### Opcion B: Docker de la clase

Si ya esta disponible la imagen de clase `image_sig_unal:final`, se puede usar el `docker-compose.yml` ubicado en la carpeta `vpenag`. Ese entorno ya incluye la mayoria de librerias geoespaciales y Quarto.

Tambien se puede levantar desde este proyecto con:

```bash
docker compose -f docker-compose.local.yml up -d
```

Este compose no descarga imagenes nuevas: usa la imagen local `image_sig_unal:final` y abre Jupyter Lab en:

```text
http://127.0.0.1:8891
```

## 1. Google Earth Engine

Archivo principal:

- `scripts/gee/01_bajo_sinu_flood_rf.js`

Pasos:

1. Cambiar `CONFIG.aoiAsset` por el asset real del poligono del Bajo Sinu.
2. Revisar las fechas `beforeStart`, `beforeEnd`, `eventStart` y `eventEnd`.
3. Ejecutar el script en el Code Editor de Earth Engine.
4. Revisar visualmente:
   - AOI.
   - Sentinel-1 evento.
   - diferencia `dVV`.
   - referencia de entrenamiento.
   - clasificacion RF.
   - severidad relativa.
5. Ejecutar las exportaciones a Google Drive.

Nota: OPERA DSWx-S1 esta activado en la configuracion final (`CONFIG.useOperaDswx = true`) porque la coleccion estuvo disponible para la ventana del evento. Si se prueba otra fecha sin cobertura OPERA, se puede cambiar a `false` para usar la referencia SAR de respaldo.

### Diferencia entre agua del evento e inundacion temporal

El Random Forest entrenado con OPERA DSWx-S1 clasifica pixeles de agua/no agua observados durante la ventana del evento. Por si solo, ese resultado puede incluir agua permanente, humedales, cienagas y cuerpos de agua estables. Para aproximar mejor la inundacion temporal del evento, el script aplica dos pasos posteriores:

1. Exclusion de agua permanente usando `JRC/GSW1_4/GlobalSurfaceWater`, banda `occurrence`. En la version candidata se consideran permanentes los pixeles con ocurrencia de agua mayor o igual a 95%.
2. Evaluacion de un filtro de conectividad para reducir ruido espacial y eliminar parches muy pequenos. El umbral exploratorio es de 8 pixeles conectados dentro de una vecindad de 25, pero el filtro no se aplica al producto final porque puede eliminar patrones pequenos y lineales asociados a inundacion riberenha o urbana.

Por esta razon, el script conserva dos capas:

- `RF agua evento cruda`: clasificacion directa del Random Forest frente a la referencia OPERA DSWx-S1.
- `RF inundacion limpia`: producto final usado para calculo de area, severidad relativa y exportaciones.
- `RF con filtro conectividad`: capa comparativa, no usada como producto final en la version candidata.

Esta decision metodologica evita presentar el resultado como una simple clasificacion agua/no agua y lo aproxima a la deteccion de areas inundadas temporalmente durante el evento.

## 2. Python

Cuando las exportaciones esten descargadas en `outputs/rf/`, ejecutar:

```bash
python scripts/python/02_postprocess_metrics.py
```

El script espera estos nombres:

- `outputs/rf/bajo_sinu_metrics_202602.csv`
- `outputs/rf/bajo_sinu_area_by_elevation_202602.csv`
- `outputs/rf/bajo_sinu_area_by_slope_202602.csv`
- `outputs/rf/bajo_sinu_flood_rf_202602.tif`
- `outputs/rf/bajo_sinu_severity_202602.tif`

Y genera:

- `outputs/tables/metricas_modelo_limpias.csv`
- `outputs/tables/area_inundada_por_elevacion_limpia.csv`
- `outputs/tables/area_inundada_por_pendiente_limpia.csv`
- `outputs/figures/area_por_elevacion.png`
- `outputs/figures/area_por_pendiente.png`
- `outputs/figures/mapa_inundacion_rf.png`
- `outputs/figures/mapa_severidad_relativa.png`

## 3. App GEE

Archivos complementarios:

- `scripts/gee/02_bajo_sinu_app_template.js`
- `scripts/gee/03_bajo_sinu_interactive_app.js`

La primera app se pega al final del script principal cuando las capas ya existen en memoria. Sirve como visor simple para mostrar AOI, diferencia SAR, DEM, pendiente, clasificacion RF y severidad relativa.

La segunda app es interactiva: permite escribir el asset ID del AOI y modificar fechas preevento/evento para recalcular el flujo de manera exploratoria. Puede tardar mas porque vuelve a construir predictores, muestras y clasificacion.

## 3.1 QGIS y GEE Data Catalog

Archivo auxiliar:

- `scripts/qgis/gee_data_catalog_quick_layers.py`

Este script contiene bloques Python/geemap para cargar rapidamente en QGIS capas como Sentinel-1 del evento, diferencia VV, DEM, pendiente, agua permanente JRC, OPERA DSWx-S1 y un RGB SAR. Se usa en la pestana Code del plugin GEE Data Catalogs. No usa sintaxis JavaScript de Earth Engine.

## 4. Quarto

El documento final se actualiza en paralelo con los resultados. Las tablas y figuras limpias generadas en `outputs/tables/` y `outputs/figures/` deben conectarse al `proyecto_final.qmd`.

## 5. Credenciales

No guardar credenciales reales en el repositorio. Si hace falta un archivo local de configuracion, usar `config/project_config.json`, que esta ignorado por git. El archivo versionado `config/project_config.example.json` solo funciona como plantilla.
