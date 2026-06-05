"""
Reproduccion local del clasificador Random Forest con scikit-learn.

Usa las muestras exportadas desde Google Earth Engine para entrenar y evaluar
un modelo local con el mismo split definido por la columna `random`.

Uso desde la raiz del proyecto:
    python scripts/python/03_rf_local_sklearn.py
"""

from pathlib import Path
import sys

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    classification_report,
)


ROOT = Path(__file__).resolve().parents[2]
RF_DIR = ROOT / "outputs" / "rf"
TABLE_DIR = ROOT / "outputs" / "tables"
TABLE_DIR.mkdir(parents=True, exist_ok=True)

SAMPLES_PATH = RF_DIR / "bajo_sinu_samples_202602.csv"

PREDICTORS = [
    "VV_before",
    "VH_before",
    "VV_event",
    "VH_event",
    "VV_minus_VH_event",
    "dVV_event_before",
    "dVH_event_before",
    "elevation",
    "slope",
]


def main() -> int:
    if not SAMPLES_PATH.exists():
        print(f"No se encontro el archivo de muestras: {SAMPLES_PATH}")
        return 1

    samples = pd.read_csv(SAMPLES_PATH)
    missing = [col for col in PREDICTORS + ["class", "random"] if col not in samples.columns]
    if missing:
        print(f"Faltan columnas requeridas: {missing}")
        return 1

    samples = samples.dropna(subset=PREDICTORS + ["class", "random"]).copy()
    train = samples[samples["random"] < 0.7]
    valid = samples[samples["random"] >= 0.7]

    model = RandomForestClassifier(
        n_estimators=200,
        max_features="sqrt",
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=13,
        n_jobs=-1,
    )

    model.fit(train[PREDICTORS], train["class"])
    predicted = model.predict(valid[PREDICTORS])

    accuracy = accuracy_score(valid["class"], predicted)
    kappa = cohen_kappa_score(valid["class"], predicted)
    matrix = confusion_matrix(valid["class"], predicted, labels=[0, 1])
    report = classification_report(valid["class"], predicted, labels=[0, 1], output_dict=True)

    metrics = pd.DataFrame(
        [
            {
                "implementation": "Python_scikit_learn",
                "accuracy": accuracy,
                "kappa": kappa,
                "n_samples": len(samples),
                "n_training": len(train),
                "n_validation": len(valid),
                "tn": matrix[0, 0],
                "fp": matrix[0, 1],
                "fn": matrix[1, 0],
                "tp": matrix[1, 1],
                "precision_class_0": report["0"]["precision"],
                "recall_class_0": report["0"]["recall"],
                "f1_class_0": report["0"]["f1-score"],
                "precision_class_1": report["1"]["precision"],
                "recall_class_1": report["1"]["recall"],
                "f1_class_1": report["1"]["f1-score"],
            }
        ]
    )

    importance = pd.DataFrame(
        {
            "variable": PREDICTORS,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    metrics_path = TABLE_DIR / "rf_python_sklearn_metricas.csv"
    importance_path = TABLE_DIR / "rf_python_sklearn_importancia.csv"
    metrics.to_csv(metrics_path, index=False)
    importance.to_csv(importance_path, index=False)

    print("Metricas RF local Python:")
    print(metrics.to_string(index=False))
    print("\nImportancia de variables:")
    print(importance.to_string(index=False))
    print(f"\nMetricas guardadas: {metrics_path}")
    print(f"Importancia guardada: {importance_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
