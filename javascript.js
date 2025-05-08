require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/symbols/SimpleLineSymbol"
], function(Map, MapView, Graphic, GraphicsLayer, SimpleMarkerSymbol, Point, Polyline, SimpleLineSymbol) {

  const map = new Map({ basemap: "streets" });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [17.1413, 60.6749],
    zoom: 13
  });

  const layers = {}; // Objekt som kan spara flera lager

  // Lägger till lager med funktioner
  addPointLayer("badplatser", "JSON/badplatser.json", "blue");
  addPointLayer("idrott_motion", "JSON/idrott_motion.json", "yellow");
  addPointLayer("lekplatser", "JSON/lekplatser.json", "orange");
  addPointLayer("livraddningsutrustning", "JSON/livraddningsutrustning.json", "purple");
  addPointLayer("offentliga_toaletter", "JSON/offentliga_toaletter.json", "cyan");
  addPointLayer("papperskorgar", "JSON/papperskorgar.json", "black");
  addPointLayer("pulkabackar", "JSON/pulkabackar.json", "indigo");
  addPointLayer("rastplatser", "JSON/rastplatser.json", "teal");
  addPointLayer("spontanidrott", "JSON/spontanidrott.json", "magenta");
  addPointLayer("utegym", "JSON/utegym.json", "green");
  getPathsData(0);

  // Funktion som hämtar JSON-data
  async function fetchData(file) {
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error(error);
    }
  }

  // Fuktion för att spaka point-lager
  async function addPointLayer(layerName, dataFile, color) {
    const layer = new GraphicsLayer();
    layers[layerName] = layer;
    map.add(layer);

    const data = await fetchData(dataFile);
    if (data) {
      showPoints(layer, data, color);
    }
  }

  // Funktion som visar punkter på lager
  function showPoints(layer, data, color) {
    layer.removeAll();

    data.features.forEach(feature => {
      const coords = feature.geometry.coordinates;
      const point = new Point({
        longitude: coords[0],
        latitude: coords[1]
      });

      const symbol = new SimpleMarkerSymbol({
        style: "circle",
        color: color,
        size: 8,
        outline: {
          color: "white",
          width: 1
        }
      });

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol
      });

      layer.add(graphic);
    });
  }

  // Funktion som läser data från JSON-fil för att sedan rita ett line-lager
  async function getPathsData(lineIndex) {
    const pathLayer = new GraphicsLayer();
    layers["Paths"] = pathLayer;
    map.add(pathLayer);

    const data = await fetchData("JSON/motionsspar.json");
    if (data) {
        showPaths(pathLayer, data, lineIndex);
    }
  }

  // Funktion för att rita ut linjer på lager
  function showPaths(layer, data, lineIndex) {
    layer.removeAll();

    // Check if the specified lineIndex exists in the features array
    const feature = data.features[lineIndex]; // Use the lineIndex parameter to select the desired line
    if (feature) {
        const coords = feature.geometry.coordinates;

        const line = new Polyline({
            paths: [coords],
            spatialReference: { wkid: 4326 }
        });

        const symbol = new SimpleLineSymbol({
            color: "blue",
            width: 3
        });

        const graphic = new Graphic({
            geometry: line,
            symbol: symbol
        });

        layer.add(graphic);
    } else {
        console.error(`Line at index ${lineIndex} does not exist.`);
    }
  }

  // Funktion som tar bort lager på kartan
  function deleteLayer(layerName) {
    const layer = layers[layerName];
    if (layer) {
        map.remove(layer);
        delete layers[layerName]; // Tar brot referensen till lagret i layers-objektet
        console.log(`Layer ${layerName} has been deleted.`);
    } else {
        console.error(`Layer ${layerName} does not exist.`);
    }
  }
});