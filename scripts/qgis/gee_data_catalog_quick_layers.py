"""
Capas rapidas para QGIS + GEE Data Catalog.

Script auxiliar en Python/geemap para cargar capas de referencia
del proyecto desde el plugin GEE Data Catalogs de QGIS. El plugin
usa `m.add_layer(...)` en lugar de la sintaxis JavaScript del
Code Editor de Earth Engine.
"""

import ee
import geemap


ee.Initialize(project="ee-vivianpenag")

m = geemap.Map()

aoi = ee.FeatureCollection("projects/ee-vivianpenag/assets/AOI")

s1_event = (
    ee.ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(aoi)
    .filterDate("2026-02-03", "2026-02-18")
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
    .select("VV")
    .min()
    .clip(aoi)
)

s1_before = (
    ee.ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(aoi)
    .filterDate("2026-01-01", "2026-01-25")
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
    .select("VV")
    .median()
    .clip(aoi)
)

dvv = s1_event.subtract(s1_before).rename("dVV")

dem = ee.Image("NASA/NASADEM_HGT/001").select("elevation").clip(aoi)
slope = ee.Terrain.slope(dem).clip(aoi)

permanent_water = (
    ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    .select("occurrence")
    .gte(95)
    .clip(aoi)
)

opera = (
    ee.ImageCollection("OPERA/DSWX/L3_V1/S1")
    .filterBounds(aoi)
    .filterDate("2026-02-03", "2026-02-18")
    .select("BWTR_Binary_water")
    .max()
    .clip(aoi)
)

s1_event_vh = (
    ee.ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(aoi)
    .filterDate("2026-02-03", "2026-02-18")
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    .select("VH")
    .min()
    .clip(aoi)
)

sar_rgb = ee.Image.cat([s1_event, s1_event_vh, dvv]).rename(
    ["VV_event", "VH_event", "dVV"]
)

m.center_object(aoi, 9)
m.add_layer(s1_event, {"min": -25, "max": 0}, "S1 VV evento")
m.add_layer(
    dvv,
    {"min": -5, "max": 5, "palette": ["08306b", "f7f7f7", "67000d"]},
    "Cambio VV evento - preevento",
)
m.add_layer(
    dem,
    {
        "min": 0,
        "max": 80,
        "palette": ["f7fcf5", "c7e9c0", "74c476", "238b45", "00441b"],
    },
    "Elevacion NASADEM",
)
m.add_layer(
    slope,
    {"min": 0, "max": 10, "palette": ["ffffcc", "a1dab4", "41b6c4", "225ea8"]},
    "Pendiente",
)
m.add_layer(
    permanent_water.selfMask(),
    {"palette": ["66c2ff"]},
    "Agua permanente JRC occurrence >= 95%",
)
m.add_layer(
    opera.eq(1).selfMask(),
    {"palette": ["005eff"]},
    "OPERA DSWx-S1 agua evento",
)
m.add_layer(
    sar_rgb,
    {
        "bands": ["VV_event", "VH_event", "dVV"],
        "min": [-25, -30, -5],
        "max": [0, -5, 5],
    },
    "SAR RGB VV VH dVV",
)
m.add_layer(aoi, {"color": "red"}, "AOI Bajo Sinu")
