require([
    "esri/Map",
    "esri/views/MapView"
  ], function(Map, MapView) {
    const map = new Map({
      basemap: "streets"
    });

    const view = new MapView({
      container: "viewDiv",
      map: map,
      center: [17.1413, 60.6749],
      zoom: 13
    });
  });


// Fuktion för att läsa in en JSON-fil.
async function fetchData(file) {
  const response = await fetch(file);
  return response.json();
}
