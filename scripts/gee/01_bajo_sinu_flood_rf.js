/***************************************************************
Proyecto final Programacion SIG
Deteccion de areas inundadas en el Bajo Sinu

Flujo principal en Google Earth Engine:
Sentinel-1 SAR, NASADEM, pendiente, OPERA DSWx-S1, JRC Global
Surface Water y Random Forest.
***************************************************************/

// =============================================================
// 0. Configuracion
// =============================================================

var CONFIG = {
  aoiAsset: 'projects/ee-vivianpenag/assets/AOI',
  // Ventana pre-evento: antes de las lluvias fuertes y del desbordamiento
  beforeStart: '2026-01-01',
  beforeEnd:   '2026-01-25',
  // Ventana del evento: pico de inundación y días posteriores inmediatos
  eventStart:  '2026-02-03',
  eventEnd:    '2026-02-18',
  exportFolder: 'Bajo_Sinu_Flood_RF',
  scale: 30,
  seed: 13,
  nSamplesPerClass: 900,
  beforeComposite: 'median',
  eventComposite: 'min',
  permanentWaterOccurrenceThreshold: 95,
  excludePermanentWaterInFinal: true,
  applyConnectivityFilter: false,
  minConnectedPixels: 8,

  // OPERA DSWx-S1 confirmado para la ventana del evento.
  useOperaDswx: true,
  operaDswxCollection: 'OPERA/DSWX/L3_V1/S1',
  operaWaterBand: 'BWTR_Binary_water'
};

var aoi = ee.FeatureCollection(CONFIG.aoiAsset).geometry();

Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'red'}, 'AOI Bajo Sinu', false);

// =============================================================
// 1. Funciones auxiliares
// =============================================================

function getS1Composite(startDate, endDate, compositeMethod) {
  var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .select(['VV', 'VH']);

  print({
    'bloque': 'Sentinel-1',
    'fecha_inicio': startDate,
    'fecha_fin': endDate,
    'compuesto': compositeMethod,
    'n_escenas': collection.size()
  });
  if (compositeMethod === 'min') {
    return collection.min().clip(aoi);
  }
  if (compositeMethod === 'p20') {
    return collection.reduce(ee.Reducer.percentile([20]))
      .rename(['VV', 'VH'])
      .clip(aoi);
  }
  return collection.median().clip(aoi);
}

function areaByClass(mask, classImage, className) {
  var grouped = ee.Image.pixelArea()
    .divide(10000)
    .rename('area_ha')
    .addBands(classImage.rename(className))
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: className}),
      geometry: aoi,
      scale: CONFIG.scale,
      maxPixels: 1e13,
      tileScale: 4
    });

  var groups = ee.List(ee.Algorithms.If(grouped.get('groups'), grouped.get('groups'), []));
  return ee.FeatureCollection(groups.map(function(item) {
    item = ee.Dictionary(item);
    return ee.Feature(null, {
      variable: className,
      rango: item.get(className),
      area_ha: item.get('sum')
    });
  }));
}

function areaHa(mask) {
  return ee.Image.pixelArea()
    .divide(10000)
    .rename('area_ha')
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: CONFIG.scale,
      maxPixels: 1e13,
      tileScale: 4
    })
    .get('area_ha');
}

function buildSarReference(dVV, dVH, vvEvent, slope) {
  // Agua abierta suele presentar baja retrodispersion y descenso temporal.
  // Referencia alternativa conservadora cuando OPERA DSWx-S1 no esta disponible.
  var waterLike = dVV.lt(-1.5)
    .and(dVH.lt(-1.0))
    .and(vvEvent.lt(-15))
    .and(slope.lte(5));

  var nonWaterLike = dVV.gt(-0.5)
    .and(dVH.gt(-0.5))
    .and(vvEvent.gt(-13));

  return ee.Image(0)
    .where(waterLike, 1)
    .where(nonWaterLike, 0)
    .updateMask(waterLike.or(nonWaterLike))
    .rename('class')
    .clip(aoi);
}

function buildOperaReference() {
  var dswx = ee.ImageCollection(CONFIG.operaDswxCollection)
    .filterBounds(aoi)
    .filterDate(CONFIG.eventStart, CONFIG.eventEnd)
    .select(CONFIG.operaWaterBand);

  print({
    'bloque': 'OPERA DSWx',
    'n_escenas_evento': dswx.size()
  });

  return dswx.map(function(img) {
      // BWTR_Binary_water: 0 = no agua, 1 = agua. Otros valores son mascaras.
      var valid = img.eq(0).or(img.eq(1));
      return img.updateMask(valid);
    })
    .max()
    .rename('class')
    .clip(aoi);
}

// =============================================================
// 2. Variables Sentinel-1
// =============================================================

var s1Before = getS1Composite(CONFIG.beforeStart, CONFIG.beforeEnd, CONFIG.beforeComposite)
  .rename(['VV_before', 'VH_before']);

var s1Event = getS1Composite(CONFIG.eventStart, CONFIG.eventEnd, CONFIG.eventComposite)
  .rename(['VV_event', 'VH_event']);

var vvMinusVhEvent = s1Event.select('VV_event')
  .subtract(s1Event.select('VH_event'))
  .rename('VV_minus_VH_event');

var dVV = s1Event.select('VV_event')
  .subtract(s1Before.select('VV_before'))
  .rename('dVV_event_before');

var dVH = s1Event.select('VH_event')
  .subtract(s1Before.select('VH_before'))
  .rename('dVH_event_before');

// =============================================================
// 3. DEM y pendiente
// =============================================================

var dem = ee.Image('NASA/NASADEM_HGT/001')
  .select('elevation')
  .rename('elevation')
  .clip(aoi);

var slope = ee.Terrain.slope(dem)
  .rename('slope')
  .clip(aoi);

// Agua permanente para evitar confundir cuerpos de agua estables con
// inundacion temporal del evento.
var permanentWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence')
  .gte(CONFIG.permanentWaterOccurrenceThreshold)
  .rename('permanent_water')
  .clip(aoi);

// =============================================================
// 4. Referencia auxiliar para entrenamiento
// =============================================================

var reference;
if (CONFIG.useOperaDswx) {
  reference = buildOperaReference();
} else {
  reference = buildSarReference(dVV, dVH, s1Event.select('VV_event'), slope);
}

Map.addLayer(reference.eq(1).selfMask(), {palette: ['0000ff']}, 'Referencia agua/inundacion', false);

// =============================================================
// 5. Stack de predictores
// =============================================================

var predictors = s1Before
  .addBands(s1Event)
  .addBands(vvMinusVhEvent)
  .addBands(dVV)
  .addBands(dVH)
  .addBands(dem)
  .addBands(slope)
  .toFloat();

var predictorBands = predictors.bandNames();
print({
  'bloque': 'Predictores',
  'bandas_predictoras': predictorBands
});

Map.addLayer(s1Event.select('VV_event'), {min: -25, max: 0}, 'S1 VV evento', false);
Map.addLayer(dVV, {min: -5, max: 5, palette: ['08306b', 'f7f7f7', '67000d']}, 'dVV evento - preevento', false);
Map.addLayer(dem, {min: 0, max: 80}, 'Elevacion NASADEM', false);
Map.addLayer(slope, {min: 0, max: 10}, 'Pendiente', false);
Map.addLayer(permanentWater.selfMask(), {palette: ['66c2ff']}, 'Agua permanente JRC', false);

// =============================================================
// 6. Muestras y Random Forest
// =============================================================

var stack = predictors.addBands(reference);

var samples = stack.stratifiedSample({
  numPoints: 0,
  classBand: 'class',
  region: aoi,
  scale: CONFIG.scale,
  classValues: [0, 1],
  classPoints: [CONFIG.nSamplesPerClass, CONFIG.nSamplesPerClass],
  seed: CONFIG.seed,
  geometries: true,
  tileScale: 4
});

samples = samples.randomColumn('random', CONFIG.seed);
var training = samples.filter(ee.Filter.lt('random', 0.7));
var validation = samples.filter(ee.Filter.gte('random', 0.7));

print({
  'bloque': 'Muestras',
  'muestras_totales': samples.size(),
  'muestras_entrenamiento': training.size(),
  'muestras_validacion': validation.size()
});

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 200,
  minLeafPopulation: 3,
  bagFraction: 0.7,
  seed: CONFIG.seed
}).train({
  features: training,
  classProperty: 'class',
  inputProperties: predictorBands
});

var floodRaw = predictors.classify(classifier).rename('flood_rf_raw').clip(aoi);

// Variantes de postproceso. Se conservan para inspeccion visual porque
// la exclusion de agua permanente puede ser agresiva en zonas riberenas.
var floodRawMask = floodRaw.eq(1).rename('flood_raw_mask').clip(aoi);

var floodWithoutPermanent = floodRawMask
  .and(permanentWater.not())
  .rename('flood_without_permanent')
  .clip(aoi);

var floodCandidate = ee.Image(ee.Algorithms.If(
    CONFIG.excludePermanentWaterInFinal,
    floodWithoutPermanent,
    floodRawMask
  ))
  .rename('flood_candidate')
  .clip(aoi);

var connectedFlood = floodCandidate.connectedPixelCount(25, true);
var floodConnected = floodCandidate
  .updateMask(connectedFlood.gte(CONFIG.minConnectedPixels))
  .unmask(0)
  .rename('flood_connected')
  .clip(aoi);

var floodRF = ee.Image(ee.Algorithms.If(
    CONFIG.applyConnectivityFilter,
    floodConnected,
    floodCandidate
  ))
  .unmask(0)
  .rename('flood_rf')
  .clip(aoi);

var floodMask = floodRF.eq(1).selfMask();

Map.addLayer(floodRaw, {min: 0, max: 1, palette: ['ffffff', '7aa6ff']}, 'RF agua evento cruda', false);
Map.addLayer(floodWithoutPermanent, {min: 0, max: 1, palette: ['ffffff', '2b8cbe']}, 'RF sin agua permanente', false);
Map.addLayer(floodConnected, {min: 0, max: 1, palette: ['ffffff', '08306b']}, 'RF con filtro conectividad', false);
Map.addLayer(floodRF, {min: 0, max: 1, palette: ['ffffff', '0040ff']}, 'RF inundacion limpia');

// =============================================================
// 7. Evaluacion
// =============================================================

var validationClassified = validation.classify(classifier);
var errorMatrix = validationClassified.errorMatrix('class', 'classification');

print({
  'bloque': 'Evaluacion Random Forest',
  'matriz_confusion': errorMatrix,
  'accuracy_global': errorMatrix.accuracy(),
  'kappa': errorMatrix.kappa(),
  'producer_accuracy': errorMatrix.producersAccuracy(),
  'user_accuracy': errorMatrix.consumersAccuracy(),
  'importancia_variables': classifier.explain()
});

// =============================================================
// 8. Area y severidad relativa
// =============================================================

var areaWaterRawHa = areaHa(floodRaw.eq(1));
var areaWithoutPermanentWaterHa = areaHa(floodWithoutPermanent.eq(1));
var areaWithConnectivityFilterHa = areaHa(floodConnected.eq(1));
var areaFloodHa = areaHa(floodMask);

print({
  'bloque': 'Comparacion de areas',
  'area_agua_evento_cruda_ha': areaWaterRawHa,
  'area_sin_agua_permanente_ha': areaWithoutPermanentWaterHa,
  'area_con_filtro_conectividad_ha': areaWithConnectivityFilterHa,
  'area_inundacion_limpia_ha': areaFloodHa,
  'excluir_agua_permanente_en_producto_final': CONFIG.excludePermanentWaterInFinal,
  'aplicar_filtro_conectividad_en_producto_final': CONFIG.applyConnectivityFilter,
  'umbral_agua_permanente_occurrence': CONFIG.permanentWaterOccurrenceThreshold,
  'min_pixeles_conectados': CONFIG.minConnectedPixels
});

var elevRange = ee.Image(0)
  .where(dem.lte(5), 1)
  .where(dem.gt(5).and(dem.lte(10)), 2)
  .where(dem.gt(10).and(dem.lte(20)), 3)
  .where(dem.gt(20), 4)
  .rename('elev_range');

var slopeRange = ee.Image(0)
  .where(slope.lte(2), 1)
  .where(slope.gt(2).and(slope.lte(5)), 2)
  .where(slope.gt(5).and(slope.lte(10)), 3)
  .where(slope.gt(10), 4)
  .rename('slope_range');

// Severidad relativa morfometrica, no profundidad ni volumen.
var severity = ee.Image(0)
  .where(floodRF.eq(1).and(dem.gt(10).or(slope.gt(5))), 1)
  .where(floodRF.eq(1).and(dem.lte(10)).and(slope.lte(5)), 2)
  .where(floodRF.eq(1).and(dem.lte(5)).and(slope.lte(2)), 3)
  .updateMask(floodRF.eq(1))
  .rename('severity_relative')
  .clip(aoi);

Map.addLayer(severity, {min: 1, max: 3, palette: ['ffffcc', 'fd8d3c', 'bd0026']}, 'Severidad relativa');

var areaByElevation = areaByClass(floodRF.eq(1), elevRange, 'elev_range');
var areaBySlope = areaByClass(floodRF.eq(1), slopeRange, 'slope_range');

var metrics = ee.FeatureCollection([
  ee.Feature(null, {
    before_start: CONFIG.beforeStart,
    before_end: CONFIG.beforeEnd,
    event_start: CONFIG.eventStart,
    event_end: CONFIG.eventEnd,
    reference_source: ee.Algorithms.If(CONFIG.useOperaDswx, 'OPERA_DSWx', 'SAR_threshold_reference'),
    area_water_raw_ha: areaWaterRawHa,
    area_without_permanent_water_ha: areaWithoutPermanentWaterHa,
    area_with_connectivity_filter_ha: areaWithConnectivityFilterHa,
    area_flood_ha: areaFloodHa,
    exclude_permanent_water_in_final: CONFIG.excludePermanentWaterInFinal,
    apply_connectivity_filter_in_final: CONFIG.applyConnectivityFilter,
    permanent_water_threshold_occurrence: CONFIG.permanentWaterOccurrenceThreshold,
    min_connected_pixels: CONFIG.minConnectedPixels,
    accuracy: errorMatrix.accuracy(),
    kappa: errorMatrix.kappa(),
    n_samples: samples.size(),
    n_training: training.size(),
    n_validation: validation.size()
  })
]);

print({
  'bloque': 'Tablas exportables',
  'area_inundada_por_elevacion': areaByElevation,
  'area_inundada_por_pendiente': areaBySlope,
  'metricas': metrics
});

// =============================================================
// 9. Exportaciones a Drive
// =============================================================

Export.image.toDrive({
  image: floodRF.toByte(),
  description: 'bajo_sinu_flood_rf_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_flood_rf_202602',
  region: aoi,
  scale: CONFIG.scale,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: severity.toByte(),
  description: 'bajo_sinu_severity_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_severity_202602',
  region: aoi,
  scale: CONFIG.scale,
  maxPixels: 1e13
});

Export.table.toDrive({
  collection: samples,
  description: 'bajo_sinu_samples_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_samples_202602',
  fileFormat: 'CSV'
});

Export.table.toDrive({
  collection: metrics,
  description: 'bajo_sinu_metrics_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_metrics_202602',
  fileFormat: 'CSV'
});

Export.table.toDrive({
  collection: areaByElevation,
  description: 'bajo_sinu_area_by_elevation_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_area_by_elevation_202602',
  fileFormat: 'CSV'
});

Export.table.toDrive({
  collection: areaBySlope,
  description: 'bajo_sinu_area_by_slope_202602',
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'bajo_sinu_area_by_slope_202602',
  fileFormat: 'CSV'
});
