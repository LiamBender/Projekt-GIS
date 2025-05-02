// ESRI moduler deklareras
let pointLayer;
let Graphic, Point, SimpleMarkerSymbol;

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/geometry/Point"
], function(Map, MapView, _Graphic, GraphicsLayer, _SimpleMarkerSymbol, _Point) {

  // Spara referenserna till modulerna globalt
  Graphic = _Graphic;
  Point = _Point;
  SimpleMarkerSymbol = _SimpleMarkerSymbol;

  const map = new Map({
    basemap: "streets"
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [17.1413, 60.6749],
    zoom: 13
  });

  pointLayer = new GraphicsLayer();
  map.add(pointLayer);

  getPointsData();
});

// Funktion som läser in JSON-fil
async function fetchData(file) {
  const response = await fetch(file);
  return response.json();
}

// Laddar in JSON-fil och punkter.
function getPointsData() {
  fetchData("JSON/papperskorgar.json").then(data => {
    showPoints(data);
  });
}

// Ritar ut punkter
function showPoints(data) {
  if (!pointLayer) return;

  pointLayer.removeAll();

  data.features.forEach(feature => {
    const coords = feature.geometry.coordinates;
    const props = feature.properties;

    const point = new Point({
      longitude: coords[0],
      latitude: coords[1]
    });

    const symbol = new SimpleMarkerSymbol({
      style: "circle",
      color: "red",
      size: 8,
      outline: {
        color: "white",
        width: 1
      }
    });

    const graphic = new Graphic({
      geometry: point,
      symbol: symbol,
      attributes: props,
    });

    pointLayer.add(graphic);
  });
}
