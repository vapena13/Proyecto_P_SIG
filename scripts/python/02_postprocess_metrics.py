"""
Postproceso local para el proyecto de inundaciones del Bajo Sinu.

Organiza tablas exportadas desde Google Earth Engine y genera figuras
derivadas para integrar en Quarto.

Uso desde la raiz del proyecto:
    python scripts/python/02_postprocess_metrics.py
"""

from pathlib import Path
from typing import Dict, Optional
import sys

import numpy as np
import pandas as pd

try:
    import rasterio
    from matplotlib.colors import BoundaryNorm, ListedColormap
    from matplotlib.patches import Patch
    import matplotlib.pyplot as plt
except ImportError:
    rasterio = None
    plt = None


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs"
RF = OUT / "rf"
FIG = OUT / "figures"
TAB = OUT / "tables"
FIG.mkdir(parents=True, exist_ok=True)
TAB.mkdir(parents=True, exist_ok=True)

FILES = {
    "metrics": RF / "bajo_sinu_metrics_202602.csv",
    "elevation": RF / "bajo_sinu_area_by_elevation_202602.csv",
    "slope": RF / "bajo_sinu_area_by_slope_202602.csv",
    "flood_tif": RF / "bajo_sinu_flood_rf_202602.tif",
    "severity_tif": RF / "bajo_sinu_severity_202602.tif",
}

ELEV_LABELS = {
    1: "0-5 m",
    2: "5-10 m",
    3: "10-20 m",
    4: ">20 m",
}

SLOPE_LABELS = {
    1: "0-2 deg",
    2: "2-5 deg",
    3: "5-10 deg",
    4: ">10 deg",
}


def read_optional_csv(path: Path) -> Optional[pd.DataFrame]:
    if not path.exists():
        print(f"No se encontro: {path}")
        return None
    return pd.read_csv(path)


def clean_area_table(
    df: pd.DataFrame,
    label_map: Dict[int, str],
    output_name: str,
) -> pd.DataFrame:
    df = df.copy()
    if "rango" in df.columns:
        df["rango"] = df["rango"].astype(int)
        df["rango_descripcion"] = df["rango"].map(label_map)
    if "area_ha" in df.columns:
        df["area_ha"] = pd.to_numeric(df["area_ha"], errors="coerce")
        df = df.sort_values("rango")
        total = df["area_ha"].sum()
        df["porcentaje"] = np.where(total > 0, df["area_ha"] / total * 100, 0)

    out_path = TAB / output_name
    df.to_csv(out_path, index=False)
    print(f"Tabla limpia guardada: {out_path}")
    return df


def plot_bar(df: pd.DataFrame, x_col: str, y_col: str, title: str, output_name: str) -> None:
    if plt is None:
        print("matplotlib no esta instalado; se omiten graficas.")
        return
    if df is None or df.empty:
        return

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(df[x_col].astype(str), df[y_col], color="#2f6f8f")
    ax.set_title(title)
    ax.set_xlabel("Rango")
    ax.set_ylabel("Area inundada (ha)")
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()

    out_path = FIG / output_name
    fig.savefig(out_path, dpi=180)
    plt.close(fig)
    print(f"Figura guardada: {out_path}")


def plot_flood_raster(path: Path, output_name: str) -> None:
    if rasterio is None or plt is None:
        print("rasterio/matplotlib no estan instalados; se omiten mapas derivados.")
        return
    if not path.exists():
        print(f"No se encontro raster: {path}")
        return

    with rasterio.open(path) as src:
        data = src.read(1).astype(float)
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = np.nan

    data[data == 0] = np.nan
    fig, ax = plt.subplots(figsize=(7, 8))
    cmap = ListedColormap(["#1f78b4"])
    ax.imshow(data, cmap=cmap, vmin=1, vmax=1)
    ax.set_title("Inundacion temporal clasificada (Random Forest)")
    ax.set_axis_off()
    ax.legend(
        handles=[Patch(facecolor="#1f78b4", edgecolor="none", label="Inundacion")],
        loc="lower right",
        frameon=True,
    )
    fig.tight_layout()

    out_path = FIG / output_name
    fig.savefig(out_path, dpi=180)
    plt.close(fig)
    print(f"Mapa derivado guardado: {out_path}")


def plot_severity_raster(path: Path, output_name: str) -> None:
    if rasterio is None or plt is None:
        print("rasterio/matplotlib no estan instalados; se omiten mapas derivados.")
        return
    if not path.exists():
        print(f"No se encontro raster: {path}")
        return

    with rasterio.open(path) as src:
        data = src.read(1).astype(float)
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = np.nan

    data[data == 0] = np.nan
    cmap = ListedColormap(["#fee08b", "#f46d43", "#a50026"])
    norm = BoundaryNorm([0.5, 1.5, 2.5, 3.5], cmap.N)

    fig, ax = plt.subplots(figsize=(7, 8))
    ax.imshow(data, cmap=cmap, norm=norm)
    ax.set_title("Severidad relativa morfometrica")
    ax.set_axis_off()
    ax.legend(
        handles=[
            Patch(facecolor="#fee08b", edgecolor="none", label="Baja"),
            Patch(facecolor="#f46d43", edgecolor="none", label="Media"),
            Patch(facecolor="#a50026", edgecolor="none", label="Alta"),
        ],
        loc="lower right",
        frameon=True,
    )
    fig.tight_layout()

    out_path = FIG / output_name
    fig.savefig(out_path, dpi=180)
    plt.close(fig)
    print(f"Mapa derivado guardado: {out_path}")


def main() -> int:
    metrics = read_optional_csv(FILES["metrics"])
    if metrics is not None:
        out_metrics = TAB / "metricas_modelo_limpias.csv"
        metrics.to_csv(out_metrics, index=False)
        print("Metricas del modelo:")
        print(metrics.to_string(index=False))
        print(f"Metricas guardadas: {out_metrics}")

    elev = read_optional_csv(FILES["elevation"])
    if elev is not None:
        elev_clean = clean_area_table(
            elev,
            ELEV_LABELS,
            "area_inundada_por_elevacion_limpia.csv",
        )
        plot_bar(
            elev_clean,
            "rango_descripcion",
            "area_ha",
            "Area inundada por elevacion",
            "area_por_elevacion.png",
        )

    slope = read_optional_csv(FILES["slope"])
    if slope is not None:
        slope_clean = clean_area_table(
            slope,
            SLOPE_LABELS,
            "area_inundada_por_pendiente_limpia.csv",
        )
        plot_bar(
            slope_clean,
            "rango_descripcion",
            "area_ha",
            "Area inundada por pendiente",
            "area_por_pendiente.png",
        )

    plot_flood_raster(FILES["flood_tif"], "mapa_inundacion_rf.png")
    plot_severity_raster(FILES["severity_tif"], "mapa_severidad_relativa.png")

    print("Postproceso finalizado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
