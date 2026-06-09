/***************************************************************
GEE App interactiva - Bajo Sinu Flood RF

Aplicacion exploratoria con parametros editables para AOI y
ventanas temporales. La version publicada prioriza estabilidad:
usa Sentinel-2 NDWI como referencia por defecto y deja OPERA
DSWx-S1 como opcion cuando la coleccion este disponible.

La app no reemplaza el flujo principal del informe. Es un visor
parametrico para explorar fechas, capas y areas estimadas.
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
  scale: 100,
  seed: 13,
  nSamplesPerClass: 120,
  nTrees: 150,
  s2CloudMax: 60,
  permanentWaterOccurrenceThreshold: 95,
  operaDswxCollection: 'OPERA/DSWX/L3_V1/S1',
  operaWaterBand: 'BWTR_Binary_water'
};

var REFERENCE_S2 = 'Sentinel-2 NDWI (recomendado app)';
var REFERENCE_SAR = 'SAR umbral simple (respaldo)';
var REFERENCE_OPERA = 'OPERA DSWx-S1 (si disponible)';

var palettes = {
  flood: ['ffffff', '0040ff'],
  raw: ['ffffff', '7aa6ff'],
  reference: ['ffffff', '00b4d8'],
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
    width: '380px',
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
  'Exploracion de inundacion con Sentinel-1, referencia auxiliar, DEM, pendiente y Random Forest.'
));

panel.add(sectionLabel('AOI'));

var aoiBox = ui.Textbox({
  placeholder: 'Asset ID del AOI',
  value: DEFAULTS.aoiAsset,
  style: {stretch: 'horizontal'}
});
panel.add(aoiBox);

panel.add(sectionLabel('Referencia para muestreo'));
var referenceSelect = ui.Select({
  items: [REFERENCE_S2, REFERENCE_SAR, REFERENCE_OPERA],
  value: REFERENCE_S2,
  style: {stretch: 'horizontal'}
});
panel.add(referenceSelect);
panel.add(ui.Label({
  value: 'Nota: OPERA puede no estar disponible para todas las fechas o cuentas. Sentinel-2 NDWI es el modo mas estable para la app.',
  style: {fontSize: '11px', color: '#555', margin: '4px 0 0 0'}
}));

panel.add(sectionLabel('Fechas preevento'));
var beforeStartBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.beforeStart});
var beforeEndBox = ui.Textbox({placeholder: 'YYYY-MM-DD', value: DEFAULTS.beforeEnd});
panel.add(row('Inicio', beforeStartBox));
panel.add(row('Fin', beforeEndBox));

panel.add(sectionLabel('Fechas evento'));
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

var statusLabel = ui.Label('Listo para ejecutar.', {color: 'green'});
var sourceLabel = ui.Label('Referencia: sin ejecutar');
var areaLabel = ui.Label('Area inundada: sin calcular', {fontWeight: 'bold'});
panel.add(statusLabel);
panel.add(sourceLabel);
panel.add(areaLabel);

panel.add(sectionLabel('Leyenda'));
panel.add(legendRow('#00b4d8', 'Referencia agua/no agua'));
panel.add(legendRow('#0040ff', 'Inundacion temporal'));
panel.add(legendRow('#bd0026', 'Severidad alta'));
panel.add(legendRow('#fd8d3c', 'Severidad media'));
panel.add(legendRow('#ffffcc', 'Severidad baja'));

function sectionLabel(value) {
  return ui.Label({
    value: value,
    style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
  });
}

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

function setBusy(message) {
  runButton.setDisabled(true);
  statusLabel.setValue(message);
  statusLabel.style().set('color', 'orange');
}

function setDone(message) {
  runButton.setDisabled(false);
  statusLabel.setValue(message);
  statusLabel.style().set('color', 'green');
}

function setError(message) {
  runButton.setDisabled(false);
  statusLabel.setValue(message);
  statusLabel.style().set('color', 'red');
}

// =============================================================
// 2. Validacion y colecciones
// =============================================================

function isDateText(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function validateDates(beforeStart, beforeEnd, eventStart, eventEnd) {
  var values = [beforeStart, beforeEnd, eventStart, eventEnd];
  for (var i = 0; i < values.length; i++) {
    if (!isDateText(values[i])) {
      return 'Use fechas con formato YYYY-MM-DD.';
    }
  }
  if (Date.parse(beforeStart) >= Date.parse(beforeEnd)) {
    return 'La fecha inicial preevento debe ser menor que la fecha final.';
  }
  if (Date.parse(eventStart) >= Date.parse(eventEnd)) {
    return 'La fecha inicial del evento debe ser menor que la fecha final.';
  }
  return null;
}

function getAoi() {
  return ee.FeatureCollection(aoiBox.getValue()).geometry();
}

function getS1Collection(aoi, startDate, endDate) {
  return ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .select(['VV', 'VH']);
}

function getS2Collection(aoi, startDate, endDate) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', DEFAULTS.s2CloudMax));
}

function getOperaCollection(aoi, startDate, endDate) {
  return ee.ImageCollection(DEFAULTS.operaDswxCollection)
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .select(DEFAULTS.operaWaterBand);
}

function s1Composite(collection, method) {
  if (method === 'min') {
    return collection.min().rename(['VV', 'VH']);
  }
  return collection.median().rename(['VV', 'VH']);
}

// =============================================================
// 3. Referencias auxiliares
// =============================================================

function buildS2WaterReference(aoi, startDate, endDate) {
  var composite = getS2Collection(aoi, startDate, endDate).median().clip(aoi);
  var ndwi = composite.normalizedDifference(['B3', 'B8']).rename('ndwi');
  return ndwi.gte(0).rename('class').clip(aoi);
}

function buildOperaReference(aoi, startDate, endDate) {
  return getOperaCollection(aoi, startDate, endDate)
    .map(function(img) {
      var valid = img.eq(0).or(img.eq(1));
      return img.updateMask(valid);
    })
    .max()
    .rename('class')
    .clip(aoi);
}

function buildSarReference(aoi, dVV, dVH, vvEvent, slope) {
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

function areaHa(mask, aoi) {
  return ee.Number(
    ee.Image.pixelArea()
      .divide(10000)
      .rename('area_ha')
      .updateMask(mask)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: DEFAULTS.scale,
        maxPixels: 1e13,
        tileScale: 4
      })
      .get('area_ha')
  );
}

// =============================================================
// 4. Ejecucion
// =============================================================

function runAnalysis() {
  map.layers().reset();
  areaLabel.setValue('Area inundada: calculando...');
  sourceLabel.setValue('Referencia: revisando disponibilidad...');

  var beforeStart = beforeStartBox.getValue();
  var beforeEnd = beforeEndBox.getValue();
  var eventStart = eventStartBox.getValue();
  var eventEnd = eventEndBox.getValue();
  var dateError = validateDates(beforeStart, beforeEnd, eventStart, eventEnd);

  if (dateError) {
    setError(dateError);
    areaLabel.setValue('Area inundada: sin calcular');
    return;
  }

  var aoi;
  try {
    aoi = getAoi();
  } catch (err) {
    setError('No se pudo leer el AOI. Revise el Asset ID.');
    return;
  }

  var referenceMode = referenceSelect.getValue();
  setBusy('Verificando disponibilidad de imagenes...');

  var s1BeforeCol = getS1Collection(aoi, beforeStart, beforeEnd);
  var s1EventCol = getS1Collection(aoi, eventStart, eventEnd);
  var s2EventCol = getS2Collection(aoi, eventStart, eventEnd);
  var countValues = {
    s1_before: s1BeforeCol.size(),
    s1_event: s1EventCol.size(),
    s2_event: s2EventCol.size(),
    opera_event: -1
  };

  // OPERA se consulta solo si el usuario lo solicita. Esto evita que la app
  // falle en servidores/cuentas donde la coleccion no este disponible.
  if (referenceMode === REFERENCE_OPERA) {
    countValues.opera_event = getOperaCollection(aoi, eventStart, eventEnd).size();
  }

  var counts = ee.Dictionary(countValues);

  counts.evaluate(function(info, error) {
    if (error) {
      setError('Error consultando colecciones. Pruebe otra referencia o fechas.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }

    if (!info || info.s1_before === 0 || info.s1_event === 0) {
      setError('Sin escenas Sentinel-1 suficientes para esas fechas.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }

    if (referenceMode === REFERENCE_S2 && info.s2_event === 0) {
      setError('Sin escenas Sentinel-2 limpias para el evento. Amplie fechas o use respaldo SAR.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }

    if (referenceMode === REFERENCE_OPERA && info.opera_event === 0) {
      setError('OPERA no tiene escenas para esa ventana. Use Sentinel-2 NDWI o respaldo SAR.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }

    sourceLabel.setValue(
      'Escenas: S1 pre=' + info.s1_before +
      ', S1 evento=' + info.s1_event +
      ', S2=' + info.s2_event +
      ', OPERA=' + (info.opera_event < 0 ? 'no consultado' : info.opera_event)
    );

    buildAndClassify(aoi, s1BeforeCol, s1EventCol, beforeStart, beforeEnd, eventStart, eventEnd, referenceMode);
  });
}

function buildAndClassify(aoi, s1BeforeCol, s1EventCol, beforeStart, beforeEnd, eventStart, eventEnd, referenceMode) {
  setBusy('Construyendo predictores y muestras...');

  var s1Before = s1Composite(s1BeforeCol, 'median')
    .rename(['VV_before', 'VH_before'])
    .clip(aoi);

  var s1Event = s1Composite(s1EventCol, 'min')
    .rename(['VV_event', 'VH_event'])
    .clip(aoi);

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
    .rename('elevation')
    .clip(aoi);

  var slope = ee.Terrain.slope(dem)
    .rename('slope')
    .clip(aoi);

  var reference;
  var referenceName;
  if (referenceMode === REFERENCE_OPERA) {
    reference = buildOperaReference(aoi, eventStart, eventEnd);
    referenceName = 'OPERA DSWx-S1';
  } else if (referenceMode === REFERENCE_SAR) {
    reference = buildSarReference(aoi, dVV, dVH, s1Event.select('VV_event'), slope);
    referenceName = 'SAR umbral simple';
  } else {
    reference = buildS2WaterReference(aoi, eventStart, eventEnd);
    referenceName = 'Sentinel-2 NDWI';
  }

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
    .toFloat();

  var stack = predictors
    .addBands(reference)
    .updateMask(reference.mask());

  var samples = stack.stratifiedSample({
    numPoints: 0,
    classBand: 'class',
    region: aoi,
    scale: DEFAULTS.scale,
    classValues: [0, 1],
    classPoints: [DEFAULTS.nSamplesPerClass, DEFAULTS.nSamplesPerClass],
    seed: DEFAULTS.seed,
    geometries: false,
    tileScale: 8
  });

  samples.aggregate_histogram('class').evaluate(function(hist, error) {
    if (error || !hist || hist['0'] === undefined || hist['1'] === undefined) {
      setError('La referencia no produjo muestras de ambas clases. Ajuste fechas o cambie referencia.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }

    continueClassification(aoi, predictors, reference, samples, predictorBands, dem, slope, s1Event, dVV, referenceName);
  });
}

function continueClassification(aoi, predictors, reference, samples, predictorBands, dem, slope, s1Event, dVV, referenceName) {
  setBusy('Entrenando Random Forest y calculando area...');

  samples = samples.randomColumn('random', DEFAULTS.seed);
  var training = samples.filter(ee.Filter.lt('random', 0.7));
  var validation = samples.filter(ee.Filter.gte('random', 0.7));

  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: DEFAULTS.nTrees,
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
    .rename('flood_final')
    .clip(aoi);

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
    bloque: 'App - Muestras',
    referencia: referenceName,
    muestras_totales: samples.size(),
    muestras_entrenamiento: training.size(),
    muestras_validacion: validation.size()
  });

  print({
    bloque: 'App - Evaluacion Random Forest',
    matriz_confusion: errorMatrix,
    accuracy_global: errorMatrix.accuracy(),
    kappa: errorMatrix.kappa()
  });

  map.centerObject(aoi, 9);
  map.addLayer(aoi, {color: 'red'}, 'AOI', false);
  map.addLayer(reference.eq(1).selfMask(), {palette: palettes.reference}, 'Referencia ' + referenceName, false);
  map.addLayer(s1Event.select('VV_event'), {min: -25, max: 0}, 'S1 VV evento', false);
  map.addLayer(dVV, {min: -5, max: 5, palette: palettes.dVV}, 'dVV evento - preevento', false);
  map.addLayer(permanentWater.selfMask(), {palette: ['66c2ff']}, 'Agua permanente JRC', false);
  map.addLayer(floodRaw, {min: 0, max: 1, palette: palettes.raw}, 'RF agua evento cruda', false);
  map.addLayer(floodFinal, {min: 0, max: 1, palette: palettes.flood}, 'Inundacion temporal RF', true);
  map.addLayer(severity, {min: 1, max: 3, palette: palettes.severity}, 'Severidad relativa', true);

  areaHa(floodFinal, aoi).evaluate(function(value, error) {
    if (error) {
      setError('Error al calcular area. Pruebe mayor escala o menor AOI.');
      areaLabel.setValue('Area inundada: sin calcular');
      return;
    }
    if (value === null) {
      setDone('Analisis finalizado con advertencias.');
      areaLabel.setValue('Area inundada: sin dato');
      return;
    }
    sourceLabel.setValue('Referencia usada: ' + referenceName);
    areaLabel.setValue('Area inundada: ' + Number(value).toFixed(2) + ' ha');
    setDone('Analisis finalizado.');
  });
}

runAnalysis();
