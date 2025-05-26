require([
  "esri/config",
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
  "esri/geometry/Polygon",
  "esri/geometry/support/webMercatorUtils",
  "esri/rest/locator",
], function (
  esriConfig,
  Map,
  MapView,
  Graphic,
  GraphicsLayer,
  SimpleMarkerSymbol,
  Point,
  Polyline,
  SimpleLineSymbol,
  Sketch,
  geometryEngine,
  Polygon,
  webMercatorUtils,
  locator
) {
  const map = new Map({ basemap: "streets" });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [17.1413, 60.6749],
    zoom: 13,
  });

  // Allmänna layers
  const layers = {}; // Objekt som kan spara flera lager

  // Adress layer
  const addressLayer = new GraphicsLayer({ id: "addressLayer" });
  map.add(addressLayer);

  //Polygon filter
  const filteredPointsLayer = new GraphicsLayer();
  const filteredPolygonLayers = {};
  map.add(filteredPointsLayer);

  // Motionsspår i polygon filter
  const filteredPolygonLineLayers = {};

  // Polygon layer
  const polygonLayer = new GraphicsLayer();
  map.add(polygonLayer);
  map.reorder(polygonLayer, 0);
  const savedPolygonCoords = [];

  // POI
  const poiLayer = new GraphicsLayer();
  map.add(poiLayer);

  let creatingPOI = false;

  window.pointHandler = function (action) {
    if (action === "create") {
      creatingPOI = true;
      view.container.style.cursor = "crosshair";
      console.log("Klicka på kartan för att lägga ut en POI.");
    } else if (action === "delete") {
      poiLayer.removeAll();
      creatingPOI = false;
      view.container.style.cursor = "default";
      console.log("Alla POI har tagits bort.");
    }
  };

  view.on("click", function (event) {
    if (!creatingPOI) return;

    creatingPOI = false;
    view.container.style.cursor = "default";

    const point = event.mapPoint;

    const name = prompt("Ange namn för POI:");
    if (name === null) return;

    const description = prompt("Ange beskrivning för POI:");
    if (description === null) return;

    const symbol = new SimpleMarkerSymbol({
      style: "circle",
      color: "black",
      size: 10,
      outline: {
        color: "white",
        width: 1,
      },
    });

    const graphic = new Graphic({
      geometry: point,
      symbol: symbol,
      attributes: {
        name: name,
        description: description,
      },
      popupTemplate: {
        title: name,
        content: description,
      },
    });

    poiLayer.add(graphic);
  });

  const sketch = new Sketch({
    layer: polygonLayer,
    view: view,
    creationMode: "single",
    availableCreateTools: ["polygon"],
    visibleElements: {
      selectionTools: false,
      settingsMenu: false,
      undoRedoMenu: false,
    },
    defaultUpdateOptions: {
      enableRotation: false,
      enableScaling: false,
      enableZ: false,
      multipleSelectionEnabled: false,
      toggleToolOnClick: false,
    },
  });
  view.ui.add(sketch, "top-right");

  sketch.on("update", function (event) {
    const eventInfo = event.toolEventInfo;
    if (eventInfo && eventInfo.type && eventInfo.type.includes("move")) {
      sketch.cancel();
    }
  });

  // Starta ej ritning direkt
  sketch.visible = false;

  window.togglePolygon = function (action) {
    if (action === "draw") {
      // Hide all layers and remove active-layer class from buttons
      Object.keys(layers).forEach((name) => {
        if (layers[name]) layers[name].visible = false;
      });
      Object.keys(filteredPolygonLayers).forEach((name) => {
        if (filteredPolygonLayers[name])
          filteredPolygonLayers[name].visible = false;
      });
      document
        .querySelectorAll(".active-layer")
        .forEach((btn) => btn.classList.remove("active-layer"));

      polygonLayer.visible = true;
      sketch.visible = true;
      sketch.create("polygon");
    } else if (action === "delete") {
      if (savedPolygonCoords.length > 0) {
        polygonLayer.removeAll();
        savedPolygonCoords.length = 0; // Rensa koordinater
        updatePointLayers(); // Uppdatera lagren så alla punkter visas
        sketch.cancel();
        sketch.visible = false;
        polygonLayer.visible = false;
        document
          .querySelectorAll(".active-layer")
          .forEach((btn) => btn.classList.remove("active-layer"));
      }
    }
  };

  sketch.on("create", (event) => {
    if (event.state === "complete") {
      const addressLayerRef = map.findLayerById("addressLayer");
      if (addressLayerRef) {
        addressLayerRef.removeAll();
      }

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
    livraddningsutrustning: {
      file: "JSON/livraddningsutrustning.json",
      color: "purple",
    },
    offentliga_toaletter: {
      file: "JSON/offentliga_toaletter.json",
      color: "cyan",
    },
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
    // Ta bort filtrerade linjelager
    for (const key in filteredPolygonLineLayers) {
      map.remove(filteredPolygonLineLayers[key]);
      delete filteredPolygonLineLayers[key];
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

    // Hantera motionsspår
    if (layers["PathsAll"]) {
      const data = await fetchData("JSON/motionsspar.json");
      if (data) {
        if (savedPolygonCoords.length > 0) {
          showPathsInPolygon(data, getColorByIndex);
        } else {
          // Visa vanliga lager
          // (Inget att göra här, lagret finns redan)
        }
      }
    }
  }

  addPointLayer("badplatser", "JSON/badplatser.json", "blue");
  addPointLayer("idrott_motion", "JSON/idrott_motion.json", "yellow");
  addPointLayer("lekplatser", "JSON/lekplatser.json", "orange");
  addPointLayer(
    "livraddningsutrustning",
    "JSON/livraddningsutrustning.json",
    "purple"
  );
  addPointLayer(
    "offentliga_toaletter",
    "JSON/offentliga_toaletter.json",
    "cyan"
  );
  addPointLayer("papperskorgar", "JSON/papperskorgar.json", "black");
  addPointLayer("pulkabackar", "JSON/pulkabackar.json", "indigo");
  addPointLayer("rastplatser", "JSON/rastplatser.json", "teal");
  addPointLayer("spontanidrott", "JSON/spontanidrott.json", "magenta");
  addPointLayer("utegym", "JSON/utegym.json", "green");
  addAllPathsLayer();

  async function fetchData(file) {
    try {
      const response = await fetch(file);
      if (!response.ok)
        throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error(error);
    }
  }

  async function addPointLayer(layerName, dataFile, color) {
    const layer = new GraphicsLayer();
    layers[layerName] = layer;
    map.add(layer);

    layer.visible = false;

    const data = await fetchData(dataFile);
    if (data) {
      if (savedPolygonCoords.length > 0) {
        showPointsInPolygon(layerName, data, color);
      } else {
        showPoints(layer, data, color);
      }
    }
  }

  function showPointsInPolygon(layerName, data, color) {
    // Ta bort gammalt lager om det finns
    if (filteredPolygonLayers[layerName]) {
      map.remove(filteredPolygonLayers[layerName]);
    }

    const layer = new GraphicsLayer();
    filteredPolygonLayers[layerName] = layer;
    map.add(layer);

    const spatialRef = view.spatialReference || { wkid: 4326 };

    data.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;

      const point = new Point({
        longitude: coords[0],
        latitude: coords[1],
        spatialReference: spatialRef,
      });

      const isInside = savedPolygonCoords.some((rings) => {
        const polygon = new Polygon({
          rings: rings,
          spatialReference: spatialRef,
        });
        return geometryEngine.contains(polygon, point);
      });

      if (isInside) {
        const symbol = new SimpleMarkerSymbol({
          style: "circle",
          color: color,
          size: 8,
          outline: { color: "white", width: 1 },
        });

        const props = feature.properties || {};

        const popupTemplate = {
          title: props.NAMN || props.name || "Details",
          content:
            Object.entries(props)
              .map(([k, v]) => `<b>${k}:</b> ${v}`)
              .join("<br>") || "No info",
        };

        const graphic = new Graphic({
          geometry: point,
          symbol: symbol,
          attributes: props,
          popupTemplate: popupTemplate,
        });

        layer.add(graphic);
      }
      layer.visible = false;
    });
  }

  function showPathsInPolygon(data, colorFunc) {
    let layer = filteredPolygonLineLayers["PathsAll"];
    if (!layer) {
      layer = new GraphicsLayer();
      filteredPolygonLineLayers["PathsAll"] = layer;
      map.add(layer);
    } else {
      layer.removeAll();
      layer.visible = true;
    }

    let count = 0;

    data.features.forEach((feature, index) => {
      const coords = feature.geometry.coordinates;
      const line = new Polyline({
        paths: [coords],
        spatialReference: { wkid: 4326 },
      });

      const isInside = savedPolygonCoords.some((rings) => {
        const fixedRings = rings.map((ring) =>
          ring.map(([x, y]) => {
            const [lng, lat] = webMercatorUtils.xyToLngLat(x, y);
            return [lng, lat];
          })
        );
        const polygon = new Polygon({
          rings: fixedRings,
          spatialReference: { wkid: 4326 },
        });
        return geometryEngine.intersects(polygon, line);
      });

      if (isInside) {
        count++;
        const color = colorFunc(index, data.features.length);
        const symbol = new SimpleLineSymbol({
          color: color,
          width: 3,
        });

        const popupTemplate = {
          title: feature.properties?.NAMN || "Motionsspår",
          content: `
          <b>Beskrivning:</b> ${feature.properties?.BESKRVN || ""}<br/>
          <b>Ändamål:</b> ${feature.properties?.ANDAMAL || ""}<br/>
          <b>Info:</b> ${feature.properties?.INFO || ""}<br/>
          <b>Extra info:</b> ${feature.properties?.EXTRA_INFO || ""}<br/>
          <b>Längd (meter):</b> ${
            feature.properties?.["Shape.STLength()"] || ""
          }<br/>
        `,
        };

        const graphic = new Graphic({
          geometry: line,
          symbol: symbol,
          attributes: feature.properties,
          popupTemplate: popupTemplate,
        });

        layer.add(graphic);
      }
    });

    layer.visible = false;
    map.reorder(layer, 1);
  }

  function showPoints(layer, data, color) {
    layer.removeAll();

    data.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      const point = new Point({
        longitude: coords[0],
        latitude: coords[1],
      });

      const symbol = new SimpleMarkerSymbol({
        style: "circle",
        color: color,
        size: 8,
        outline: {
          color: "white",
          width: 1,
        },
      });

      const props = feature.properties || {};

      let content = "";
      for (const key in props) {
        if (
          props.hasOwnProperty(key) &&
          props[key] !== null &&
          props[key] !== undefined
        ) {
          let value = props[key];
          if (typeof value === "string" && value.match(/^https?:\/\//)) {
            value = `<a href="${value}" target="_blank">${value}</a>`;
          }
          content += `<b>${key}:</b> ${value}<br>`;
        }
      }

      const popupTemplate = {
        title: props.NAMN || props.name || "Details",
        content: content || "No additional information available.",
      };

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
        attributes: props,
        popupTemplate: popupTemplate,
      });

      layer.add(graphic);
    });
  }

  function getColorByIndex(index, total) {
    const COLORS = [
      "#e6194b",
      "#3cb44b",
      "#ffe119",
      "#4363d8",
      "#f58231",
      "#911eb4",
      "#46f0f0",
      "#f032e6",
      "#bcf60c",
      "#fabebe",
      "#008080",
      "#e6beff",
      "#9a6324",
      "#fffac8",
      "#800000",
      "#aaffc3",
      "#808000",
      "#ffd8b1",
      "#000075",
      "#808080",
      "#d2f53c",
      "#faff00",
      "#a9a9a9",
      "#b6a6ca",
      "#ffb3ba",
      "#c6e2ff",
      "#b5ead7",
      "#ffdac1",
      "#ff9aa2",
      "#b28dff",
      "#ffb347",
      "#cfcfc4",
      "#f1cbff",
      "#b7e4c7",
      "#d0f4de",
      "#e2cfc4",
      "#e0bbff",
      "#b3ffd9",
      "#ffdfba",
      "#f3c6e8",
      "#baffc9",
    ];
    if (index < COLORS.length) {
      return COLORS[index];
    }
    return `hsl(${((index * 360) / total) % 360}, 80%, 45%)`;
  }

  async function getPathsData(lineIndex) {
    const pathLayer = new GraphicsLayer();
    layers[`Paths${lineIndex}`] = pathLayer;
    map.add(pathLayer);

    const data = await fetchData("JSON/motionsspar.json");
    if (data) {
      showPaths(pathLayer, data, lineIndex);
    }
  }

  function showPaths(layer, data, lineIndex) {
    layer.removeAll();

    const totalFeatures = data.features.length;
    const feature = data.features[lineIndex];

    if (feature) {
      const coords = feature.geometry.coordinates;

      const line = new Polyline({
        paths: [coords],
        spatialReference: { wkid: 4326 },
      });

      const color = getColorByIndex(lineIndex, totalFeatures);

      const symbol = new SimpleLineSymbol({
        color: color,
        width: 3,
      });

      const popupTemplate = {
        title: "{NAMN}",
        content: `
          <b>Beskrivning:</b> {BESKRVN}<br/>
          <b>Ändamål:</b> {ANDAMAL}<br/>
          <b>Info:</b> {INFO}<br/>
          <b>Extra info:</b> {EXTRA_INFO}<br/>
          <b>Längd (meter):</b> {Shape.STLength()}<br/>
        `,
      };

      const graphic = new Graphic({
        geometry: line,
        symbol: symbol,
        attributes: feature.properties,
        popupTemplate: popupTemplate,
      });

      layer.add(graphic);
    } else {
      console.error(`Line at index ${lineIndex} does not exist.`);
    }
  }

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
          spatialReference: { wkid: 4326 },
        });

        const color = getColorByIndex(index, totalFeatures);

        const symbol = new SimpleLineSymbol({
          color: color,
          width: 3,
        });

        const popupTemplate = {
          title: "{NAMN}",
          content: `
            <b>Beskrivning:</b> {BESKRVN}<br/>
            <b>Ändamål:</b> {ANDAMAL}<br/>
            <b>Info:</b> {INFO}<br/>
            <b>Extra info:</b> {EXTRA_INFO}<br/>
            <b>Längd (meter):</b> {Shape.STLength()}<br/>
          `,
        };

        const graphic = new Graphic({
          geometry: line,
          symbol: symbol,
          attributes: feature.properties,
          popupTemplate: popupTemplate,
        });

        pathLayer.add(graphic);
      });
    }
  }

  function deleteLayer(layerName) {
    const layer = layers[layerName];
    if (layer) {
      map.remove(layer);
      delete layers[layerName];
      console.log(`Layer ${layerName} has been deleted.`);
    } else {
      console.error(`Layer ${layerName} does not exist.`);
    }
  }

  window.toggleLayer = async function (layerName) {
    const isPointLayer = !!layerInfo[layerName];
    const isPathsAll = layerName === "PathsAll";
    if (savedPolygonCoords.length > 0 && (isPointLayer || isPathsAll)) {
      let layer;
      if (isPointLayer) {
        layer = filteredPolygonLayers[layerName];
      } else if (isPathsAll) {
        layer = filteredPolygonLineLayers["PathsAll"];
        if (!layer) {
          const data = await fetchData("JSON/motionsspar.json");
          if (data) {
            showPathsInPolygon(data, getColorByIndex);
            layer = filteredPolygonLineLayers["PathsAll"];
          }
        }
      }
      if (layer) {
        layer.visible = !layer.visible;
        const buttons = document.querySelectorAll(
          `[onclick="toggleLayer('${layerName}')"]`
        );
        buttons.forEach((button) =>
          button.classList.toggle("active-layer", layer.visible)
        );
        console.log(
          `${layerName} i polygonen är nu ${
            layer.visible ? "synliga" : "dolda"
          }`
        );
      } else {
        console.warn(`Inga objekt i polygonen för ${layerName}`);
      }
      return;
    }

    const layer = layers[layerName];
    if (layer) {
      layer.visible = !layer.visible;

      const buttons = document.querySelectorAll(
        `[onclick="toggleLayer('${layerName}')"]`
      );
      buttons.forEach((button) =>
        button.classList.toggle("active-layer", layer.visible)
      );

      console.log(
        `Lagret "${layerName}" är nu ${layer.visible ? "synligt" : "dolt"}`
      );
    } else {
      console.error(`Lagret "${layerName}" finns inte`);
    }
  };

  window.filterFunction = async function () {
    const input = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();

    if (!input) {
      Object.keys(layers).forEach((name) => {
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
        const toggleButton = document.querySelector(
          `[onclick="toggleLayer('PathsAll')"]`
        );
        if (toggleButton && toggleButton.classList.contains("active-layer")) {
          pathsAllLayer.visible = true;
        } else {
          pathsAllLayer.visible = false;
        }
      }

      document
        .querySelectorAll(".active-layer")
        .forEach((btn) => btn.classList.remove("active-layer"));
      return;
    }

    const searchableLayers = {
      badplatser: "badplatser",
      livräddningsutrustning: "livraddningsutrustning",
      pulkabackar: "pulkabackar",
      idrott: "idrott_motion",
      motion: "idrott_motion",
      motionsspår: "PathsAll",
      spontanidrott: "spontanidrott",
      utegym: "utegym",
      lekplatser: "lekplatser",
      rastplatser: "rastplatser",
      papperskorgar: "papperskorgar",
      toaletter: "offentliga_toaletter",
      "offentliga toaletter": "offentliga_toaletter",
    };

    let matchFound = false;

    Object.keys(layers).forEach((name) => {
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
          const buttons = document.querySelectorAll(
            `[onclick="toggleLayer('${layerName}')"]`
          );
          buttons.forEach((button) => button.classList.add("active-layer"));
        }
        break;
      }
    }

    if (!matchFound) {
      const data = await fetchData("JSON/motionsspar.json");
      if (data && data.features) {
        const index = data.features.findIndex(
          (f) => f.properties?.NAMN?.toLowerCase().trim() === input
        );

        if (index !== -1) {
          // Ta bort tidigare individuella motionsspår
          Object.keys(layers).forEach((name) => {
            if (name.startsWith("Paths") && name !== "PathsAll") {
              map.remove(layers[name]);
              delete layers[name];
            }
            // DÖLJ alla andra lager
            if (!name.startsWith("SearchResult")) {
              layers[name].visible = false;
            }
          });

          // Rensa SearchResult-lager
          Object.keys(layers).forEach((name) => {
            if (name.startsWith("SearchResult")) {
              map.remove(layers[name]);
              delete layers[name];
            }
          });

          getPathsData(index);
          matchFound = true;
          return;
        }
      }
    }

    if (!matchFound) {
      const pointFiles = [
        { name: "badplatser", file: "JSON/badplatser.json", color: "blue" },
        {
          name: "idrott_motion",
          file: "JSON/idrott_motion.json",
          color: "yellow",
        },
        { name: "lekplatser", file: "JSON/lekplatser.json", color: "orange" },
        {
          name: "livraddningsutrustning",
          file: "JSON/livraddningsutrustning.json",
          color: "purple",
        },
        {
          name: "offentliga_toaletter",
          file: "JSON/offentliga_toaletter.json",
          color: "cyan",
        },
        {
          name: "papperskorgar",
          file: "JSON/papperskorgar.json",
          color: "black",
        },
        { name: "pulkabackar", file: "JSON/pulkabackar.json", color: "indigo" },
        { name: "rastplatser", file: "JSON/rastplatser.json", color: "teal" },
        {
          name: "spontanidrott",
          file: "JSON/spontanidrott.json",
          color: "magenta",
        },
        { name: "utegym", file: "JSON/utegym.json", color: "green" },
      ];

      Object.keys(layers).forEach((name) => {
        if (name.startsWith("SearchResult")) {
          map.remove(layers[name]);
          delete layers[name];
        }
      });

      for (const layerInfo of pointFiles) {
        const data = await fetchData(layerInfo.file);
        if (!data || !data.features) continue;

        const matchedGraphics = [];

        data.features.forEach((feature) => {
          const props = feature.properties || {};
          for (const key in props) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes("namn") || keyLower.includes("typ")) {
              const val = props[key];
              if (
                typeof val === "string" &&
                val.toLowerCase().includes(input)
              ) {
                const coords = feature.geometry.coordinates;
                const point = new Point({
                  longitude: coords[0],
                  latitude: coords[1],
                });

                const symbol = new SimpleMarkerSymbol({
                  style: "circle",
                  color: layerInfo.color,
                  size: 8,
                  outline: {
                    color: "white",
                    width: 1,
                  },
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
                    content: content,
                  },
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
    const suggestionsBox = document.getElementById("suggestions");
    suggestionsBox.innerHTML = "";
    suggestionsBox.style.display = "none";

    const sources = [
      { name: "Motionsspår", file: "JSON/motionsspar.json" },
      { name: "Badplatser", file: "JSON/badplatser.json" },
      { name: "Idrott & Motion", file: "JSON/idrott_motion.json" },
      { name: "Lekplatser", file: "JSON/lekplatser.json" },
      {
        name: "Livräddningsutrustning",
        file: "JSON/livraddningsutrustning.json",
      },
      { name: "Offentliga toaletter", file: "JSON/offentliga_toaletter.json" },
      { name: "Papperskorgar", file: "JSON/papperskorgar.json" },
      { name: "Pulkabackar", file: "JSON/pulkabackar.json" },
      { name: "Rastplatser", file: "JSON/rastplatser.json" },
      { name: "Spontanidrott", file: "JSON/spontanidrott.json" },
      { name: "Utegym", file: "JSON/utegym.json" },
    ];

    const seenValues = new Set();

    for (const source of sources) {
      const data = await fetchData(source.file);
      if (data && data.features) {
        data.features.forEach((feature) => {
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

                  const div = document.createElement("div");
                  div.textContent = uniqueKey;
                  div.dataset.value = value.toLowerCase();
                  div.onclick = () => {
                    document.getElementById("searchInput").value = value;
                    suggestionsBox.style.display = "none";
                    filterFunction();
                  };

                  suggestionsBox.appendChild(div);
                }
                break;
              }
            }
          }
        });
      }
    }
  }

  document.getElementById("searchInput").addEventListener("input", function () {
    let inputVal = this.value.trim();

    const match = inputVal.match(/^[^:]+:\s*(.*)$/);
    if (match) {
      this.value = match[1];
    }
  });

  populateAutocomplete();

  populateAutocomplete();

  document.getElementById("searchInput").addEventListener("input", function () {
    // Ta bort prefix om användaren klistrat in något med "Kategori (Namn): ..."
    const match = this.value.match(/^[^:]+:\s*(.*)$/);
    if (match) this.value = match[1];

    const value = this.value.toLowerCase().trim();
    const box = document.getElementById("suggestions");
    const options = Array.from(box.children);
    let matches = 0;

    options.forEach((option) => {
      const isMatch = option.dataset.value?.startsWith(value);

      option.style.display = isMatch ? "block" : "none";
      if (isMatch) matches++;
    });

    box.style.display = matches > 0 ? "block" : "none";
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#suggestions") && e.target.id !== "searchInput") {
      document.getElementById("suggestions").style.display = "none";
    }
  });

  // ---- FILTER FUNKTIONER (VARNING: HACKIGT SOM FAN!!!) ----

  // Storear det sista grafiska objektet på klick
  window._lastSelectedGraphic = null;
  view.on("click", function (event) {
    view.hitTest(event).then(function (response) {
      if (response.results.length > 0) {
        const result = response.results.find((r) => r.graphic);
        if (result) {
          window._lastSelectedGraphic = result.graphic;
        }
      }
    });
  });

  // Weird fucked up sine-funktion hack för distans
  function haversine(lon1, lat1, lon2, lat2) {
    // Returnar distans i meter
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  window.filterAllLayersByProximity = function (selectedGraphic) {
    if (!selectedGraphic) return;
    const refGeom = selectedGraphic.geometry;
    const lon1 = refGeom.longitude,
      lat1 = refGeom.latitude;

    // Får avstånd baserat på användarinput (defaultar till 50m)
    const distanceInput = document.getElementById("distanceInput");
    const filterDistance = distanceInput ? Number(distanceInput.value) : 50;

    const pointLayerNames = [
      "badplatser",
      "idrott_motion",
      "lekplatser",
      "livraddningsutrustning",
      "offentliga_toaletter",
      "papperskorgar",
      "pulkabackar",
      "rastplatser",
      "spontanidrott",
      "utegym",
    ];
    pointLayerNames.forEach((layerName) => {
      const layer = layers[layerName];
      if (!layer) return;
      if (!layer._originalGraphics) {
        layer._originalGraphics = layer.graphics.toArray();
      }
      const graphicsToKeep = layer._originalGraphics.filter((graphic) => {
        if (graphic === selectedGraphic) return true;
        let geom = graphic.geometry;
        if (geom.type !== "point") return false;
        const lon2 = geom.longitude,
          lat2 = geom.latitude;
        const dist = haversine(lon1, lat1, lon2, lat2);
        return dist !== null && dist <= filterDistance;
      });
      layer.removeAll();
      graphicsToKeep.forEach((g) => layer.add(g));
    });
  };

  // Funktion för att återställa lager
  window.restoreLayerGraphics = function (layerName) {
    const layer = layers[layerName];
    if (!layer || !layer._originalGraphics) return;
    layer.removeAll();
    layer._originalGraphics.forEach((g) => layer.add(g));
  };

  // API adressökning via Geocoding
  // AAPTxy8BH1VEsoebNVZXo8HurGuzNiuipj3FeKc7J3bGv8MaeMrTf_4Cd93WYmOpXvbA7CaNK_hxZ9yggnHAS3EBCSERDu9xA5Aamx855-nVlZyF0eg2FhfAJkrBrAl8vZ4C4Jf7ShQRCMflvFOZiEZYkrNdRlqSHkz6T9H-DIOtfmucYgvNGbI6dxd6C2o3oOU8JKRygADxbDRc4qWKQoJo1ZQ0V_ICixNhnJSxVtJNExg.AT1_5p5pSRQ3
  // https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/<request>?<parameters>&f=json&token=<ACCESS_TOKEN>
  // const apiKey = "AAPTxy8BH1VEsoebNVZXo8HurGuzNiuipj3FeKc7J3bGv8MaeMrTf_4Cd93WYmOpXvbA7CaNK_hxZ9yggnHAS3EBCSERDu9xA5Aamx855-nVlZyF0eg2FhfAJkrBrAl8vZ4C4Jf7ShQRCMflvFOZiEZYkrNdRlqSHkz6T9H-DIOtfmucYgvNGbI6dxd6C2o3oOU8JKRygADxbDRc4qWKQoJo1ZQ0V_ICixNhnJSxVtJNExg.AT1_5p5pSRQ3";

  esriConfig.apiKey =
    "AAPTxy8BH1VEsoebNVZXo8HurGuzNiuipj3FeKc7J3bGv8MaeMrTf_4Cd93WYmOpXvbA7CaNK_hxZ9yggnHAS3EBCSERDu9xA5Aamx855-nVlZyF0eg2FhfAJkrBrAl8vZ4C4Jf7ShQRCMflvFOZiEZYkrNdRlqSHkz6T9H-DIOtfmucYgvNGbI6dxd6C2o3oOU8JKRygADxbDRc4qWKQoJo1ZQ0V_ICixNhnJSxVtJNExg.AT1_5p5pSRQ3";

  window.geocodeAddress = function () {
    const input = document.getElementById("addressInput").value;
    const resultBox = document.getElementById("resultBox");

    if (!input) {
      resultBox.textContent = "⚠️ Skriv in en adress.";
      return;
    }

    const geocodingServiceUrl =
      "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    const params = {
      address: {
        address: input,
      },
    };

    locator
      .addressToLocations(geocodingServiceUrl, params)
      .then((results) => {
        if (results.length) {
          const result = results[0];
          addressLayer.removeAll();

          addressLayer.add(
            new Graphic({
              symbol: {
                type: "simple-marker",
                color: "#000000",
                size: "8px",
                outline: {
                  color: "#ffffff",
                  width: "1px",
                },
              },
              geometry: result.location,
              attributes: {
                title: "Address",
                address: result.address,
                score: result.score,
              },
              popupTemplate: {
                title: "{title}",
                content:
                  result.address +
                  "<br><br>" +
                  result.location.longitude.toFixed(5) +
                  "," +
                  result.location.latitude.toFixed(5),
              },
            })
          );

          view.goTo({
            target: result.location,
            zoom: 13,
          });

          if (view.popup && typeof view.popup.open === "function") {
            view.popup.open({
              location: result.location,
              title: "Sökresultat",
              content: result.address,
            });
          } else {
            console.warn("⚠️ view.popup.open() är inte tillgänglig.");
          }

          resultBox.textContent = `✅ Adress hittad:\n${result.address}`;
        } else {
          resultBox.textContent = "❌ Ingen träff på adressen.";
        }
      })
      .catch((error) => {
        resultBox.textContent =
          "❌ Ett fel uppstod vid sökning:\n" + error.message;
        console.error(error);
      });
  };
});
