/***************************************************************
GEE App interactiva - Bajo Sinu Flood RF

Aplicacion exploratoria con parametros editables para AOI y
ventanas temporales. El AOI se define mediante un asset de Earth
Engine; la interfaz publica no gestiona archivos locales.

El flujo recalcula predictores, muestras, clasificacion Random Forest,
inundacion temporal, severidad relativa y area estimada.
***************************************************************/

// =============================================================
// 0. Configuracion base
// =============================================================

var DEFAULTS = {
  aoiAsset: 'projects/ee-vivianpenag/assets/AOI',
  beforeStart: '2026-01-01',
  beforeEnd: '2026-01-25',
  eventStart: '2026-02-03',
  eventEnd: '2026-02-18',
  scale: 30,
  seed: 13,
  nSamplesPerClass: 600,
  permanentWaterOccurrenceThreshold: 95,
  operaDswxCollection: 'OPERA/DSWX/L3_V1/S1',
  operaWaterBand: 'BWTR_Binary_water'
};

var palettes = {
  flood: ['ffffff', '0040ff'],
  raw: ['ffffff', '7aa6ff'],
  severity: ['ffffcc', 'fd8d3c', 'bd0026'],
  dVV: ['08306b', 'f7f7f7', '67000d']
};

// =============================================================
// 1. UI
// =============================================================

ui.root.clear();
ui.root.setLayout(ui.Panel.Layout.Flow('horizontal'));

var map = ui.Map();
map.setOptions('HYBRID');
map.style().set('stretch', 'both');

var panel = ui.Panel({
  style: {
    width: '360px',
    padding: '12px'
  }
});

ui.root.add(panel);
ui.root.add(map);

panel.add(ui.Label({
  value: 'Bajo Sinu - Flood RF',
  style: {fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0'}
}));

panel.add(ui.Label(
  'Clasificacion exploratoria de inundacion con Sentinel-1, OPERA DSWx-S1, DEM y pendiente.'
));

panel.add(ui.Label({
  value: 'AOI',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));

var aoiBox = ui.Textbox({
  placeholder: 'Asset ID del AOI',
  value: DEFAULTS.aoiAsset,
  style: {stretch: 'horizontal'}
});
panel.add(aoiBox);

panel.add(ui.Label({
  value: 'Fechas preevento',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));

var beforeStartBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.beforeStart});
var beforeEndBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.beforeEnd});
panel.add(row('Inicio', beforeStartBox));
panel.add(row('Fin', beforeEndBox));

panel.add(ui.Label({
  value: 'Fechas evento',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));

var eventStartBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.eventStart});
var eventEndBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.eventEnd});
panel.add(row('Inicio', eventStartBox));
panel.add(row('Fin', eventEndBox));

var runButton = ui.Button({
  label: 'Ejecutar analisis',
  style: {stretch: 'horizontal', margin: '12px 0 6px 0'},
  onClick: runAnalysis
});
panel.add(runButton);

var statusLabel = ui.Label('Listo para ejecutar.');
var areaLabel = ui.Label('Area inundada: sin calcular');
panel.add(statusLabel);
panel.add(areaLabel);

panel.add(ui.Label({
  value: 'Leyenda',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));
panel.add(legendRow('#0040ff', 'Inundacion temporal'));
panel.add(legendRow('#bd0026', 'Severidad alta'));
panel.add(legendRow('#fd8d3c', 'Severidad media'));
panel.add(legendRow('#ffffcc', 'Severidad baja'));

function row(label, widget) {
  return ui.Panel({
    widgets: [
      ui.Label(label, {width: '56px'}),
      widget
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {stretch: 'horizontal'}
  });
}

function legendRow(color, label) {
  return ui.Panel({
    widgets: [
      ui.Label('', {
        backgroundColor: color,
        padding: '8px',
        margin: '0 8px 4px 0'
      }),
      ui.Label(label)
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}

// =============================================================
// 2. Funciones de procesamiento
// =============================================================

function getAoi() {
  var asset = aoiBox.getValue();
  return ee.FeatureCollection(asset).geometry();
}

function getS1Composite(aoi, startDate, endDate, method) {
  var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .select(['VV', 'VH']);

  print({
    bloque: 'Sentinel-1',
    fecha_inicio: startDate,
    fecha_fin: endDate,
    n_escenas: collection.size()
  });

  if (method === 'min') {
    return collection.min().rename(['VV', 'VH']).clip(aoi);
  }
  return collection.median().rename(['VV', 'VH']).clip(aoi);
}

function buildOperaReference(aoi, startDate, endDate) {
  var dswx = ee.ImageCollection(DEFAULTS.operaDswxCollection)
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .select(DEFAULTS.operaWaterBand);

  print({
    bloque: 'OPERA DSWx',
    n_escenas_evento: dswx.size()
  });

  return dswx.map(function(img) {
      var valid = img.eq(0).or(img.eq(1));
      return img.updateMask(valid);
    })
    .max()
    .rename('class')
    .clip(aoi);
}

function areaHa(mask, aoi) {
  return ee.Number(
    ee.Image.pixelArea()
      .divide(10000)
      .updateMask(mask)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: DEFAULTS.scale,
        maxPixels: 1e13,
        tileScale: 4
      })
      .get('area')
  );
}

function runAnalysis() {
  map.layers().reset();
  statusLabel.setValue('Ejecutando analisis...');
  areaLabel.setValue('Area inundada: calculando...');

  var aoi = getAoi();
  var beforeStart = beforeStartBox.getValue();
  var beforeEnd = beforeEndBox.getValue();
  var eventStart = eventStartBox.getValue();
  var eventEnd = eventEndBox.getValue();

  var s1Before = getS1Composite(aoi, beforeStart, beforeEnd, 'median')
    .rename(['VV_before', 'VH_before']);
  var s1Event = getS1Composite(aoi, eventStart, eventEnd, 'min')
    .rename(['VV_event', 'VH_event']);

  var dVV = s1Event.select('VV_event')
    .subtract(s1Before.select('VV_before'))
    .rename('dVV_event_before');
  var dVH = s1Event.select('VH_event')
    .subtract(s1Before.select('VH_before'))
    .rename('dVH_event_before');
  var vvMinusVh = s1Event.select('VV_event')
    .subtract(s1Event.select('VH_event'))
    .rename('VV_minus_VH_event');

  var dem = ee.Image('NASA/NASADEM_HGT/001')
    .select('elevation')
    .clip(aoi);
  var slope = ee.Terrain.slope(dem)
    .rename('slope')
    .clip(aoi);

  var reference = buildOperaReference(aoi, eventStart, eventEnd);

  var predictorBands = [
    'VV_before',
    'VH_before',
    'VV_event',
    'VH_event',
    'VV_minus_VH_event',
    'dVV_event_before',
    'dVH_event_before',
    'elevation',
    'slope'
  ];

  var predictors = s1Before
    .addBands(s1Event)
    .addBands(vvMinusVh)
    .addBands(dVV)
    .addBands(dVH)
    .addBands(dem)
    .addBands(slope)
    .addBands(reference)
    .updateMask(reference.mask());

  var samples = predictors.stratifiedSample({
    numPoints: 0,
    classBand: 'class',
    region: aoi,
    scale: DEFAULTS.scale,
    classValues: [0, 1],
    classPoints: [DEFAULTS.nSamplesPerClass, DEFAULTS.nSamplesPerClass],
    seed: DEFAULTS.seed,
    geometries: true,
    tileScale: 4
  });

  samples = samples.randomColumn('random', DEFAULTS.seed);
  var training = samples.filter(ee.Filter.lt('random', 0.7));
  var validation = samples.filter(ee.Filter.gte('random', 0.7));

  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 200,
    minLeafPopulation: 3,
    bagFraction: 0.7,
    seed: DEFAULTS.seed
  }).train({
    features: training,
    classProperty: 'class',
    inputProperties: predictorBands
  });

  var floodRaw = predictors.classify(classifier)
    .rename('flood_rf_raw')
    .clip(aoi);

  var permanentWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
    .select('occurrence')
    .gte(DEFAULTS.permanentWaterOccurrenceThreshold)
    .clip(aoi);

  var floodFinal = floodRaw.eq(1)
    .and(permanentWater.not())
    .rename('flood_final');

  var elevLow = dem.lt(5);
  var slopeLow = slope.lt(2);
  var severity = ee.Image(0)
    .where(floodFinal.and(elevLow).and(slopeLow), 3)
    .where(floodFinal.and(elevLow).and(slopeLow.not()), 2)
    .where(floodFinal.and(elevLow.not()).and(slopeLow), 2)
    .where(floodFinal.and(elevLow.not()).and(slopeLow.not()), 1)
    .updateMask(floodFinal)
    .rename('severity_relative');

  var validated = validation.classify(classifier);
  var errorMatrix = validated.errorMatrix('class', 'classification');

  print({
    bloque: 'Muestras',
    muestras_totales: samples.size(),
    muestras_entrenamiento: training.size(),
    muestras_validacion: validation.size()
  });
  print({
    bloque: 'Evaluacion Random Forest',
    matriz_confusion: errorMatrix,
    accuracy_global: errorMatrix.accuracy(),
    kappa: errorMatrix.kappa()
  });

  map.centerObject(aoi, 9);
  map.addLayer(aoi, {color: 'red'}, 'AOI', false);
  map.addLayer(s1Event.select('VV_event'), {min: -25, max: 0}, 'S1 VV evento', false);
  map.addLayer(dVV, {min: -5, max: 5, palette: palettes.dVV}, 'dVV evento - preevento', false);
  map.addLayer(permanentWater.selfMask(), {palette: ['66c2ff']}, 'Agua permanente JRC', false);
  map.addLayer(floodRaw, {min: 0, max: 1, palette: palettes.raw}, 'RF agua evento cruda', false);
  map.addLayer(floodFinal, {min: 0, max: 1, palette: palettes.flood}, 'Inundacion temporal RF', true);
  map.addLayer(severity, {min: 1, max: 3, palette: palettes.severity}, 'Severidad relativa', true);

  var areaFloodHa = areaHa(floodFinal, aoi);
  areaFloodHa.evaluate(function(value) {
    if (value === null) {
      areaLabel.setValue('Area inundada: sin dato');
    } else {
      areaLabel.setValue('Area inundada: ' + Number(value).toFixed(2) + ' ha');
    }
    statusLabel.setValue('Analisis finalizado.');
  });
}

runAnalysis();
