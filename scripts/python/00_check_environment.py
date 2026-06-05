"""
Chequeo minimo del entorno reproducible del proyecto.

Uso:
    python scripts/python/00_check_environment.py
"""

from __future__ import annotations

import importlib
import platform
import subprocess
import sys


PACKAGES = [
    "ee",
    "geemap",
    "geopandas",
    "numpy",
    "pandas",
    "rasterio",
    "sklearn",
    "matplotlib",
]


def package_version(name: str) -> str:
    module = importlib.import_module(name)
    return getattr(module, "__version__", "installed")


def command_version(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return "not found"
    text = (result.stdout or result.stderr).strip().splitlines()
    return text[0] if text else "available"


def main() -> int:
    print(f"Python: {sys.version.split()[0]}")
    print(f"Platform: {platform.platform()}")
    print(f"Quarto: {command_version(['quarto', '--version'])}")
    print(f"GDAL: {command_version(['gdalinfo', '--version'])}")
    print(f"Julia: {command_version(['julia', '--version'])}")
    print("")
    print("Python packages:")
    for package in PACKAGES:
        try:
            print(f"- {package}: {package_version(package)}")
        except ImportError:
            print(f"- {package}: missing")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
