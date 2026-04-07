from pathlib import Path
import geopandas as gpd

shp_path = Path("/home/rstudio/work/Proyecto_final/data/vector/raw/depto.shp")
out_dir = Path("/home/rstudio/work/Proyecto_final/data/vector/processed")
out_dir.mkdir(parents=True, exist_ok=True)

geojson_path = out_dir / "depto.geojson"

gdf = gpd.read_file(shp_path)

print("CRS original:", gdf.crs)

if gdf.crs is not None and gdf.crs.to_string() != "EPSG:4326":
    gdf = gdf.to_crs(epsg=4326)

gdf.to_file(geojson_path, driver="GeoJSON")

print(f"GeoJSON guardado en: {geojson_path}")
print(gdf.head())