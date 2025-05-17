require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/symbols/SimpleLineSymbol",
  "esri/widgets/Sketch",
  "esri/geometry/geometryEngine",
  "esri/geometry/Polygon"
], function (Map, MapView, Graphic, GraphicsLayer, SimpleMarkerSymbol, Point, Polyline, SimpleLineSymbol, Sketch, geometryEngine, Polygon) {

  const map = new Map({ basemap: "streets" });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [17.1413, 60.6749],
    zoom: 13
  });

  const layers = {}; // Objekt som kan spara flera lager
  const filteredPointsLayer = new GraphicsLayer();
  const filteredPolygonLayers = {};
  map.add(filteredPointsLayer);

  const polygonLayer = new GraphicsLayer();
  map.add(polygonLayer);

  const sketch = new Sketch({
    layer: polygonLayer,
    view: view,
    creationMode: "update",
    availableCreateTools: ["polygon"]
  });
  view.ui.add(sketch, "top-right");

  // Starta ej ritning direkt
  sketch.visible = false;

  window.togglePolygon = function (action) {
    if (action === 'draw') {
      polygonLayer.visible = true;
      sketch.visible = true;
      sketch.create("polygon");
    } else if (action === 'delete') {
      polygonLayer.removeAll();
      savedPolygonCoords.length = 0;   // Rensa koordinater
      updatePointLayers();             // Uppdatera lagren så alla punkter visas
      sketch.cancel();
      sketch.visible = false;
      polygonLayer.visible = false;
    }
  };

  // När ritningen är klar ska vi avsluta ritning OCH gömma widgeten
  // Global array för att spara polygonernas koordinater
  const savedPolygonCoords = [];

  sketch.on("create", (event) => {
    if (event.state === "complete") {
      // Lägg till polygonen i lagret
      polygonLayer.add(event.graphic);

      // Extrahera polygonens koordinater (rings)
      const polygonCoords = event.graphic.geometry.rings;

      // Spara koordinaterna i den globala arrayen
      savedPolygonCoords.push(polygonCoords);

      console.log("Sparade polygonkoordinater:", savedPolygonCoords);

      updatePointLayers();

      // Avsluta ritning och göm widgeten
      sketch.cancel();
      sketch.visible = false;
    }
  });

  const layerInfo = {
    badplatser: { file: "JSON/badplatser.json", color: "blue" },
    idrott_motion: { file: "JSON/idrott_motion.json", color: "yellow" },
    lekplatser: { file: "JSON/lekplatser.json", color: "orange" },
    livraddningsutrustning: { file: "JSON/livraddningsutrustning.json", color: "purple" },
    offentliga_toaletter: { file: "JSON/offentliga_toaletter.json", color: "cyan" },
    papperskorgar: { file: "JSON/papperskorgar.json", color: "black" },
    pulkabackar: { file: "JSON/pulkabackar.json", color: "indigo" },
    rastplatser: { file: "JSON/rastplatser.json", color: "teal" },
    spontanidrott: { file: "JSON/spontanidrott.json", color: "magenta" },
    utegym: { file: "JSON/utegym.json", color: "green" },
  };

  async function updatePointLayers() {
    // Ta bort alla gamla filtrerade polygonlager
    for (const key in filteredPolygonLayers) {
      map.remove(filteredPolygonLayers[key]);
      delete filteredPolygonLayers[key];
    }

    for (const layerName in layers) {
      const layer = layers[layerName];
      const info = layerInfo[layerName];
      if (!info) continue;

      const data = await fetchData(info.file);

      if (data) {
        if (savedPolygonCoords.length > 0) {
          showPointsInPolygon(layerName, data, info.color);
        } else {
          showPoints(layer, data, info.color);
        }
      }
    }
  }

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
      if (savedPolygonCoords.length > 0) {
        // The array has at least one item
        showPointsInPolygon(data, color);
      } else {
        // The array is empty
        showPoints(layer, data, color);
      }
    }
  }

  // Ändra showPointsInPolygon:
  function showPointsInPolygon(layerName, data, color) {
    // Ta bort gammalt lager om det finns
    if (filteredPolygonLayers[layerName]) {
      map.remove(filteredPolygonLayers[layerName]);
    }

    const layer = new GraphicsLayer();
    filteredPolygonLayers[layerName] = layer;
    map.add(layer);

    const spatialRef = view.spatialReference || { wkid: 4326 };

    data.features.forEach(feature => {
      const coords = feature.geometry.coordinates;

      const point = new Point({
        longitude: coords[0],
        latitude: coords[1],
        spatialReference: spatialRef
      });

      const isInside = savedPolygonCoords.some(rings => {
        const polygon = new Polygon({ rings: rings, spatialReference: spatialRef });
        return geometryEngine.contains(polygon, point);
      });

      if (isInside) {
        const symbol = new SimpleMarkerSymbol({
          style: "circle",
          color: color,
          size: 8,
          outline: { color: "white", width: 1 }
        });

        const props = feature.properties || {};

        const popupTemplate = {
          title: props.NAMN || props.name || "Details",
          content: Object.entries(props).map(([k, v]) => `<b>${k}:</b> ${v}`).join("<br>") || "No info"
        };

        const graphic = new Graphic({
          geometry: point,
          symbol: symbol,
          attributes: props,
          popupTemplate: popupTemplate
        });

        layer.add(graphic);
      }
    });

    layer.visible = false;
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


  // Genererar färg baserad på index
  function getColorByIndex(index, total) {
    // Lista med färger
    const COLORS = [
      "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6",
      "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000", "#aaffc3",
      "#808000", "#ffd8b1", "#000075", "#808080", "#d2f53c", "#faff00", "#a9a9a9", "#b6a6ca",
      "#ffb3ba", "#c6e2ff", "#b5ead7", "#ffdac1", "#ff9aa2", "#b28dff", "#ffb347", "#cfcfc4",
      "#f1cbff", "#b7e4c7", "#d0f4de", "#e2cfc4", "#e0bbff", "#b3ffd9", "#ffdfba", "#f3c6e8",
      "#baffc9"
    ];
    // Om indexen finns i listan så används deras färg
    if (index < COLORS.length) {
      return COLORS[index];
    }
    // Annan färg genereras om indexet når gränsen av listan
    return `hsl(${(index * 360 / total) % 360}, 80%, 45%)`;
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

  // Funktion för att rita ut linjer på lager, nu med olika färg per linje
  function showPaths(layer, data, lineIndex) {
    layer.removeAll();

    const totalFeatures = data.features.length;
    // Checkar om lineIndex finns i features arrayen
    const feature = data.features[lineIndex];
    if (feature) {
      const coords = feature.geometry.coordinates;

      const line = new Polyline({
        paths: [coords],
        spatialReference: { wkid: 4326 }
      });

      const color = getColorByIndex(lineIndex, totalFeatures);

      const symbol = new SimpleLineSymbol({
        color: color,
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

  // Modifierad funktion: varje path ritas i unik färg
  async function addAllPathsLayer() {
    const pathLayer = new GraphicsLayer();
    layers["PathsAll"] = pathLayer;
    map.add(pathLayer);
    pathLayer.visible = false;

    const data = await fetchData("JSON/motionsspar.json");
    if (data) {
      const totalFeatures = data.features.length;
      data.features.forEach((feature, index) => {
        const coords = feature.geometry.coordinates;

        const line = new Polyline({
          paths: [coords],
          spatialReference: { wkid: 4326 }
        });

        const color = getColorByIndex(index, totalFeatures);

        const symbol = new SimpleLineSymbol({
          color: color,
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

  // Modifierad funktion: varje path ritas i unik färg
  async function addAllPathsLayer() {
    const pathLayer = new GraphicsLayer();
    layers["PathsAll"] = pathLayer;
    map.add(pathLayer);
    pathLayer.visible = false;

    const data = await fetchData("JSON/motionsspar.json");
    if (data) {
      const totalFeatures = data.features.length;
      data.features.forEach((feature, index) => {
        const coords = feature.geometry.coordinates;

        const line = new Polyline({
          paths: [coords],
          spatialReference: { wkid: 4326 }
        });

        const color = getColorByIndex(index, totalFeatures);

        const symbol = new SimpleLineSymbol({
          color: color,
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

  // Ändra toggleLayer:
  window.toggleLayer = function (layerName) {
    const isPointLayer = !!layerInfo[layerName];
    if (savedPolygonCoords.length > 0 && isPointLayer) {
      const layer = filteredPolygonLayers[layerName];
      if (layer) {
        layer.visible = !layer.visible;

        // Visuell feedback på knappen
        const buttons = document.querySelectorAll(`a[href='#'][onclick="toggleLayer('${layerName}')"]`);
        buttons.forEach(button => {
          button.classList.toggle("active-layer", layer.visible);
        });

        console.log(`Punkter i polygonen för ${layerName} är nu ${layer.visible ? "synliga" : "dolda"}`);
      } else {
        console.warn(`Inga punkter i polygonen för ${layerName}`);
      }
      return;
    }

    // Standardbeteende om ingen polygon finns eller om det inte är ett punktlager
    const layer = layers[layerName];
    if (layer) {
      layer.visible = !layer.visible;

      const buttons = document.querySelectorAll(`a[href='#'][onclick="toggleLayer('${layerName}')"]`);
      buttons.forEach(button => {
        button.classList.toggle("active-layer", layer.visible);
      });

      console.log(`Lagret "${layerName}" är nu ${layer.visible ? "synligt" : "dolt"}`);
    } else {
      console.error(`Lagret "${layerName}" finns inte`);
    }
  };

  // Sökfilter för olika objekt
  window.filterFunction = async function () {
    const input = document.getElementById("searchInput").value.toLowerCase().trim();

    if (!input) {
      Object.keys(layers).forEach(name => {
        const layer = layers[name];
        if (!layer) return;

        if (name.startsWith("SearchResult")) {
          map.remove(layer);
          delete layers[name];
        } else {
          layer.visible = false;
        }
      });

      const pathsAllLayer = layers["PathsAll"];
      if (pathsAllLayer) {
        const toggleButton = document.querySelector(`a[href='#'][onclick="toggleLayer('PathsAll')"]`);
        if (toggleButton && toggleButton.classList.contains("active-layer")) {
          pathsAllLayer.visible = true;
        } else {
          pathsAllLayer.visible = false;
        }
      }

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

    Object.keys(layers).forEach(name => {
      if (!name.startsWith("SearchResult")) {
        layers[name].visible = false;
      }
    });

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

    if (!matchFound) {
      const data = await fetchData("JSON/motionsspar.json");
      if (data && data.features) {
        const index = data.features.findIndex(f =>
          f.properties?.NAMN?.toLowerCase().trim() === input
        );

        if (index !== -1) {
          Object.keys(layers).forEach(name => {
            if (name.startsWith("Paths") && name !== "PathsAll") {
              map.remove(layers[name]);
              delete layers[name];
            }
          });

          getPathsData(index);
          matchFound = true;
        }
      }
    }

    // 3. Sök i punktdata – baserat på både namn och typ
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
            const keyLower = key.toLowerCase();
            if (keyLower.includes("namn") || keyLower.includes("typ")) {
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
                break;
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

    const seenValues = new Set(); // För att undvika dubbletter

    for (const source of sources) {
      const data = await fetchData(source.file);
      if (data && data.features) {
        data.features.forEach(feature => {
          const props = feature.properties || {};
          for (const key in props) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes("namn") || keyLower.includes("typ")) {
              const value = props[key];
              if (value && typeof value === "string") {
                const label = keyLower.includes("typ") ? "(Typ)" : "(Namn)";
                const uniqueKey = `${source.name} ${label}: ${value}`;
                if (!seenValues.has(uniqueKey)) {
                  seenValues.add(uniqueKey);

                  const option = document.createElement("option");
                  option.value = uniqueKey;
                  datalist.appendChild(option);
                }
                break; // Sluta efter första matchande fält
              }
            }
          }
        });
      }
    }
  }




  // Add event listener to the search input field
  document.getElementById("searchInput").addEventListener("input", function () {
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