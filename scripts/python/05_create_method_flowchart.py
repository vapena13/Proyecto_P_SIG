from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


OUT = Path("outputs/figures/flujo_metodologico.png")


def box(ax, xy, text, color="#eef5ff", width=3.4, height=0.82):
    x, y = xy
    patch = FancyBboxPatch(
        (x - width / 2, y - height / 2),
        width,
        height,
        boxstyle="round,pad=0.04,rounding_size=0.05",
        linewidth=1.1,
        edgecolor="#334155",
        facecolor=color,
    )
    ax.add_patch(patch)
    ax.text(x, y, text, ha="center", va="center", fontsize=8.2)


def arrow(ax, start, end):
    ax.add_patch(
        FancyArrowPatch(
            start,
            end,
            arrowstyle="-|>",
            mutation_scale=11,
            linewidth=1.0,
            color="#334155",
        )
    )


def main():
    fig, ax = plt.subplots(figsize=(11, 7.2))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis("off")

    box(ax, (7, 9.2), "1. AOI y evento\nBajo Sinú, febrero 2026", "#dbeafe", 4.8, 0.9)

    data = [
        (1.7, 7.6, "Sentinel-1 SAR\npreevento/evento"),
        (4.2, 7.6, "OPERA DSWx-S1\nreferencia auxiliar"),
        (6.7, 7.6, "NASADEM\nelevación"),
        (9.2, 7.6, "Pendiente\nee.Terrain.slope()"),
        (11.7, 7.6, "JRC GSW\nagua permanente"),
    ]
    for x, y, text in data:
        box(ax, (x, y), text, "#fef3c7", 2.25, 0.82)
        arrow(ax, (7, 8.75), (x, 8.05))

    box(ax, (3.0, 5.8), "Filtrado temporal y espacial\nmisma zona de estudio", "#dcfce7", 3.4, 0.82)
    box(ax, (6.8, 5.8), "Compuestos SAR\nmediana preevento / mínimo evento", "#dcfce7", 3.8, 0.82)
    box(ax, (10.8, 5.8), "Stack multibanda\nVV, VH, ΔVV, ΔVH, VV-VH,\nelevación y pendiente", "#dcfce7", 3.9, 1.0)

    arrow(ax, (1.7, 7.15), (3.0, 6.25))
    arrow(ax, (3.0, 5.4), (6.8, 5.4))
    arrow(ax, (6.8, 5.4), (10.8, 5.4))
    arrow(ax, (6.7, 7.15), (10.0, 6.25))
    arrow(ax, (9.2, 7.15), (11.0, 6.25))

    box(ax, (2.4, 3.8), "Muestreo estratificado\nagua / no agua", "#f3e8ff", 2.8, 0.82)
    box(ax, (5.0, 3.8), "70% entrenamiento\n30% validación", "#f3e8ff", 2.5, 0.82)
    box(ax, (7.5, 3.8), "Random Forest\n200 árboles", "#f3e8ff", 2.3, 0.82)
    box(ax, (10.1, 3.8), "Clasificación de agua\ndurante el evento", "#f3e8ff", 2.7, 0.82)

    arrow(ax, (4.2, 7.15), (2.4, 4.25))
    arrow(ax, (10.8, 5.25), (2.4, 4.25))
    arrow(ax, (3.8, 3.8), (4.0, 3.8))
    arrow(ax, (6.25, 3.8), (6.35, 3.8))
    arrow(ax, (8.65, 3.8), (8.8, 3.8))

    box(ax, (5.0, 2.0), "Exclusión de agua permanente\nJRC occurrence ≥ 95%", "#fee2e2", 3.6, 0.82)
    box(ax, (8.9, 2.0), "Máscara final de\ninundación temporal", "#fee2e2", 3.0, 0.82)
    arrow(ax, (10.1, 3.35), (5.8, 2.45))
    arrow(ax, (11.7, 7.15), (5.7, 2.45))
    arrow(ax, (6.8, 2.0), (7.4, 2.0))

    outputs = [
        (2.0, 0.65, "Área\ninundada"),
        (4.4, 0.65, "Distribución\npor elevación"),
        (6.8, 0.65, "Distribución\npor pendiente"),
        (9.2, 0.65, "Severidad relativa\nmorfométrica"),
        (12.0, 0.65, "Mapas, tablas,\nmétricas, app e informe"),
    ]
    for x, y, text in outputs:
        box(ax, (x, y), text, "#e0f2fe", 2.25, 0.78)
        arrow(ax, (8.9, 1.55), (x, 1.05))

    ax.text(7, 9.85, "Flujo metodológico del proyecto", ha="center", va="top", fontsize=13, weight="bold")
    fig.tight_layout()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=220, bbox_inches="tight")


if __name__ == "__main__":
    main()
