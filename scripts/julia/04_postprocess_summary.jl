#!/usr/bin/env julia

# Resumen tabular en Julia de las salidas generadas por GEE/Python.

using CSV
using DataFrames

root = dirname(dirname(dirname(@__FILE__)))
tables_dir = joinpath(root, "outputs", "tables")
rf_dir = joinpath(root, "outputs", "rf")

metrics_path = joinpath(tables_dir, "metricas_modelo_limpias.csv")
elev_path = joinpath(tables_dir, "area_inundada_por_elevacion_limpia.csv")
slope_path = joinpath(tables_dir, "area_inundada_por_pendiente_limpia.csv")
samples_path = joinpath(rf_dir, "bajo_sinu_samples_202602.csv")

metrics = CSV.read(metrics_path, DataFrame)
elev = CSV.read(elev_path, DataFrame)
slope = CSV.read(slope_path, DataFrame)
samples = CSV.read(samples_path, DataFrame)

summary = DataFrame(
    implementation = ["Julia_summary"],
    area_flood_ha = [metrics.area_flood_ha[1]],
    accuracy_gee = [metrics.accuracy[1]],
    kappa_gee = [metrics.kappa[1]],
    n_samples = [nrow(samples)],
    n_training = [sum(samples.random .< 0.7)],
    n_validation = [sum(samples.random .>= 0.7)],
    pct_elevation_0_5m = [elev.porcentaje[elev.rango_descripcion .== "0-5 m"][1]],
    pct_slope_0_2deg = [slope.porcentaje[slope.rango_descripcion .== "0-2 deg"][1]],
)

out_path = joinpath(tables_dir, "julia_resumen_postproceso.csv")
CSV.write(out_path, summary)

println("Resumen Julia:")
show(summary, allcols=true)
println("\nResumen guardado en: ", out_path)
