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