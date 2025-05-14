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
  addAllPathsLayer();
  // getPathsData(0);
  // getPathsData(5);
  // deleteLayer("Paths5");

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

    layer.visible = false;

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
    layers[`Paths${lineIndex}`] = pathLayer;
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

// Funktion som togglar synligheten av ett lager
window.toggleLayer = function(layerName) {
  const layer = layers[layerName];
  if (layer) {
    // Växla synlighet på lagret
    layer.visible = !layer.visible;

    // Lägg till/ta bort CSS-klass för visuell feedback på knappen
    const buttons = document.querySelectorAll(`a[href='#'][onclick="toggleLayer('${layerName}')"]`);
    buttons.forEach(button => {
      button.classList.toggle("active-layer", layer.visible);  // Lägg till/ta bort klassen baserat på synlighet
    });

    console.log(`Lagret "${layerName}" är nu ${layer.visible ? "synligt" : "dolt"}`);
  } else {
    console.error(`Lagret "${layerName}" finns inte`);
  }
};

// Funktion som lägger till alla paths-lager
async function addAllPathsLayer() {
  const pathLayer = new GraphicsLayer();
  layers["PathsAll"] = pathLayer;
  map.add(pathLayer);
  pathLayer.visible = false;

  const data = await fetchData("JSON/motionsspar.json");
  if (data) {
    data.features.forEach(feature => {
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

      pathLayer.add(graphic);
    });
  }
}

// Sökfilter för olika objekt
window.filterFunction = async function () {
  const input = document.getElementById("searchInput").value.toLowerCase().trim();
  if (!input) return;

  const searchableLayers = {
    "badplatser": "badplatser",
    "livräddningsutrustning": "livraddningsutrustning",
    "pulkabackar": "pulkabackar",
    "idrott": "idrott_motion",
    "motion": "idrott_motion",
    "motionsspår": "PathsAll",
    "spontanidrott": "spontanidrott",
    "utegym": "utegym",
    "lekplatser": "lekplatser",
    "rastplatser": "rastplatser",
    "papperskorgar": "papperskorgar",
    "toaletter": "offentliga_toaletter",
    "offentliga toaletter": "offentliga_toaletter"
  };

  let matchFound = false;

  // 1. Kontrollera om det är ett standardlager
  for (const [key, layerName] of Object.entries(searchableLayers)) {
    if (input === key) {
      matchFound = true;

      Object.keys(layers).forEach(name => {
        if (layers[name]) layers[name].visible = false;
      });

      const layer = layers[layerName];
      if (layer) {
        layer.visible = true;

        const buttons = document.querySelectorAll(`a[href='#'][onclick="toggleLayer('${layerName}')"]`);
        buttons.forEach(button => {
          button.classList.add("active-layer");
        });
      }
      break;
    }
  }

  // 2. Om inget vanligt lager hittades, kolla motionsspårens namn
  if (!matchFound) {
    const data = await fetchData("JSON/motionsspar.json");
    if (data && data.features) {
      const index = data.features.findIndex(f =>
        f.properties.NAMN && f.properties.NAMN.toLowerCase().trim() === input
      );

      if (index !== -1) {
        Object.keys(layers).forEach(name => {
          if (layers[name]) layers[name].visible = false;
        });

        const layerName = `Paths${index}`;
        deleteLayer(layerName);
        getPathsData(index);  // Visa det enskilda spåret
        matchFound = true;
      }
    }
  }

  if (!matchFound) {
    console.warn("Inget lager eller spår hittades för:", input);
  }
};

// Fyll datalist med NAMN från motionsspår
async function populateAutocomplete() {
  const data = await fetchData("JSON/motionsspar.json");
  const datalist = document.getElementById("suggestions");

  if (data && data.features) {
    const names = data.features.map(f => f.properties.NAMN).filter(Boolean);
    datalist.innerHTML = ""; // Rensa gamla förslag

    names.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      datalist.appendChild(option);
    });
  }
}

// Kör direkt när sidan laddas
populateAutocomplete();







});