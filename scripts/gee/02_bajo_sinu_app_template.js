/***************************************************************
Plantilla de GEE App

Visor de resultados finales. Reutiliza las capas creadas por
`01_bajo_sinu_flood_rf.js` y agrega un panel de area, control
de capas y leyenda de severidad relativa.
***************************************************************/

var panel = ui.Panel({
  style: {width: '320px', padding: '12px'}
});

panel.add(ui.Label({
  value: 'Bajo Sinu - Inundacion RF',
  style: {fontSize: '18px', fontWeight: 'bold'}
}));

panel.add(ui.Label(
  'Clasificacion Random Forest con Sentinel-1, DEM y pendiente. ' +
  'La severidad es relativa y no representa profundidad hidraulica.'
));

var areaLabel = ui.Label('Area inundada estimada: calculando...');
panel.add(areaLabel);

areaFloodHa.evaluate(function(value) {
  var text = value === null
    ? 'Area inundada estimada: sin dato'
    : 'Area inundada estimada: ' + Number(value).toFixed(2) + ' ha';
  areaLabel.setValue(text);
});

panel.add(ui.Label({
  value: 'Capas',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));

var layerNames = [
  'AOI Bajo Sinu',
  'S1 VV evento',
  'dVV evento - preevento',
  'Elevacion NASADEM',
  'Pendiente',
  'Agua permanente JRC',
  'RF agua evento cruda',
  'RF inundacion limpia',
  'Severidad relativa'
];

layerNames.forEach(function(name) {
  var checkbox = ui.Checkbox({
    label: name,
    value: name === 'RF inundacion limpia' || name === 'Severidad relativa',
    onChange: function(checked) {
      Map.layers().forEach(function(layer) {
        if (layer.getName() === name) {
          layer.setShown(checked);
        }
      });
    }
  });
  panel.add(checkbox);
});

panel.add(ui.Label({
  value: 'Leyenda severidad',
  style: {fontWeight: 'bold', margin: '12px 0 4px 0'}
}));

function legendRow(color, label) {
  return ui.Panel({
    widgets: [
      ui.Label('', {backgroundColor: color, padding: '8px', margin: '0 8px 4px 0'}),
      ui.Label(label)
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}

panel.add(legendRow('#bd0026', 'Alta: baja elevacion y baja pendiente'));
panel.add(legendRow('#fd8d3c', 'Media'));
panel.add(legendRow('#ffffcc', 'Baja'));

ui.root.insert(0, panel);
