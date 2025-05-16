require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/symbols/SimpleLineSymbol"
], function (Map, MapView, Graphic, GraphicsLayer, SimpleMarkerSymbol, Point, Polyline, SimpleLineSymbol) {

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

      const props = feature.properties || {};

      // Build popup content dynamically from all properties
      let content = "";
      for (const key in props) {
        if (props.hasOwnProperty(key) && props[key] !== null && props[key] !== undefined) {
          let value = props[key];
          // If value looks like a URL, make it clickable
          if (typeof value === "string" && value.match(/^https?:\/\//)) {
            value = `<a href="${value}" target="_blank">${value}</a>`;
          }
          content += `<b>${key}:</b> ${value}<br>`;
        }
      }

      const popupTemplate = {
        title: props.NAMN || props.name || "Details",
        content: content || "No additional information available."
      };

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
        attributes: props,
        popupTemplate: popupTemplate
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
  window.toggleLayer = function (layerName) {
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

  // Om sökfältet är tomt – ta bort bara temporära söklager
  if (!input) {
    Object.keys(layers).forEach(name => {
      const layer = layers[name];
      if (!layer) return;

      if (name.startsWith("SearchResult") || name.startsWith("Paths")) {
        map.remove(layer);
        delete layers[name];
      } else {
        layer.visible = false;
      }
    });

    // Ta bort visuell highlight från knappar
    document.querySelectorAll("a.active-layer").forEach(btn => btn.classList.remove("active-layer"));
    return;
  }

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

  // Dölj alla standardlager (utan att ta bort deras grafik)
  Object.keys(layers).forEach(name => {
    if (!name.startsWith("SearchResult")) {
      layers[name].visible = false;
    }
  });

  // 1. Direkt matchning mot nyckelord
  for (const [key, layerName] of Object.entries(searchableLayers)) {
    if (input === key) {
      matchFound = true;

      const layer = layers[layerName];
      if (layer) {
        layer.visible = true;
        const buttons = document.querySelectorAll(`a[href='#'][onclick="toggleLayer('${layerName}')"]`);
        buttons.forEach(button => button.classList.add("active-layer"));
      }
      break;
    }
  }

  // 2. Matcha mot motionsspårens namn
  if (!matchFound) {
    const data = await fetchData("JSON/motionsspar.json");
    if (data && data.features) {
      const index = data.features.findIndex(f =>
        f.properties?.NAMN?.toLowerCase().trim() === input
      );

      if (index !== -1) {
        Object.keys(layers).forEach(name => {
          if (name.startsWith("Paths")) {
            map.remove(layers[name]);
            delete layers[name];
          }
        });

        getPathsData(index);
        matchFound = true;
      }
    }
  }

  // 3. Sök i alla punktdata efter namn-matchning
  if (!matchFound) {
    const pointFiles = [
      { name: "badplatser", file: "JSON/badplatser.json", color: "blue" },
      { name: "idrott_motion", file: "JSON/idrott_motion.json", color: "yellow" },
      { name: "lekplatser", file: "JSON/lekplatser.json", color: "orange" },
      { name: "livraddningsutrustning", file: "JSON/livraddningsutrustning.json", color: "purple" },
      { name: "offentliga_toaletter", file: "JSON/offentliga_toaletter.json", color: "cyan" },
      { name: "papperskorgar", file: "JSON/papperskorgar.json", color: "black" },
      { name: "pulkabackar", file: "JSON/pulkabackar.json", color: "indigo" },
      { name: "rastplatser", file: "JSON/rastplatser.json", color: "teal" },
      { name: "spontanidrott", file: "JSON/spontanidrott.json", color: "magenta" },
      { name: "utegym", file: "JSON/utegym.json", color: "green" }
    ];

    // Ta bort tidigare söklager
    Object.keys(layers).forEach(name => {
      if (name.startsWith("SearchResult")) {
        map.remove(layers[name]);
        delete layers[name];
      }
    });

    for (const layerInfo of pointFiles) {
      const data = await fetchData(layerInfo.file);
      if (!data || !data.features) continue;

      const matchedGraphics = [];

      data.features.forEach(feature => {
        const props = feature.properties || {};
        for (const key in props) {
          if (key.toLowerCase().includes("namn")) {
            const val = props[key];
            if (typeof val === "string" && val.toLowerCase().includes(input)) {
              const coords = feature.geometry.coordinates;
              const point = new Point({
                longitude: coords[0],
                latitude: coords[1]
              });

              const symbol = new SimpleMarkerSymbol({
                style: "circle",
                color: layerInfo.color,
                size: 8,
                outline: {
                  color: "white",
                  width: 1
                }
              });

              let content = "";
              for (const p in props) {
                if (props[p]) {
                  let v = props[p];
                  if (typeof v === "string" && v.match(/^https?:\/\//)) {
                    v = `<a href="${v}" target="_blank">${v}</a>`;
                  }
                  content += `<b>${p}:</b> ${v}<br>`;
                }
              }

              const graphic = new Graphic({
                geometry: point,
                symbol: symbol,
                attributes: props,
                popupTemplate: {
                  title: props[key],
                  content: content
                }
              });

              matchedGraphics.push(graphic);
              break; // Stoppa vid första match
            }
          }
        }
      });

      if (matchedGraphics.length > 0) {
        const tempLayerName = `SearchResult_${layerInfo.name}`;
        let searchLayer = layers[tempLayerName];

        if (!searchLayer) {
          searchLayer = new GraphicsLayer();
          layers[tempLayerName] = searchLayer;
          map.add(searchLayer);
        }

        searchLayer.removeAll();
        searchLayer.visible = true;
        searchLayer.addMany(matchedGraphics);

        matchFound = true;
      }
    }
  }

  if (!matchFound) {
    console.warn("Inget objekt hittades för:", input);
  }
};



async function populateAutocomplete() {
  const datalist = document.getElementById("suggestions");
  datalist.innerHTML = ""; // Rensa gamla förslag

  // Lista över alla filer och vad de representerar
  const sources = [
    { name: "Motionsspår", file: "JSON/motionsspar.json", propertyKey: "NAMN" },
    { name: "Badplatser", file: "JSON/badplatser.json" },
    { name: "Idrott & Motion", file: "JSON/idrott_motion.json" },
    { name: "Lekplatser", file: "JSON/lekplatser.json" },
    { name: "Livräddningsutrustning", file: "JSON/livraddningsutrustning.json" },
    { name: "Offentliga toaletter", file: "JSON/offentliga_toaletter.json" },
    { name: "Papperskorgar", file: "JSON/papperskorgar.json" },
    { name: "Pulkabackar", file: "JSON/pulkabackar.json" },
    { name: "Rastplatser", file: "JSON/rastplatser.json" },
    { name: "Spontanidrott", file: "JSON/spontanidrott.json" },
    { name: "Utegym", file: "JSON/utegym.json" }
  ];

  for (const source of sources) {
    const data = await fetchData(source.file);
    if (data && data.features) {
      data.features.forEach(feature => {
        const props = feature.properties || {};
        for (const key in props) {
          if (key.toLowerCase().includes("namn")) {
            const value = props[key];
            if (value && typeof value === "string") {
              const option = document.createElement("option");
              option.value = `${source.name}: ${value}`;
              datalist.appendChild(option);
              break; // Vi lägger bara till första matchande namn-nyckeln
            }
          }
        }
      });
    }
  }
}

// Add event listener to the search input field
document.getElementById("searchInput").addEventListener("input", function() {
  // Get the current value of the input
  let inputVal = this.value.trim();

  // Check if the value contains ": " and remove the part before and including ": "
  const match = inputVal.match(/^[^:]+:\s*(.*)$/); // Match everything before ": "
  if (match) {
    // If a match is found, update the input value to only show the part after ": "
    this.value = match[1];
  }
});

// Call populateAutocomplete to fill the datalist
populateAutocomplete();








});