///////////////////////////////////////////////////////////////////////////
// Copyright 2017 Esri
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//    http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    "dojo/_base/array",
    "dojo/_base/declare", 
    "dojo/_base/Color",
    "dojo/_base/lang",
    "dojo/Deferred",
    "dojo/DeferredList",
    "dojo/on",
    "esri/geometry/Point",
    "esri/graphic", 
    "esri/request",
    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/SimpleFillSymbol", 
    "esri/symbols/SimpleLineSymbol", 
    "esri/symbols/SimpleMarkerSymbol", 
    "esri/units",
    "./tasks/LRSTask",
    "./util/utils",
    "dojo/i18n!./nls/strings",
    "dojo/i18n!esri/nls/jsapi"
], function(
    array, declare, Color, lang, Deferred, DeferredList, on, 
    Point, Graphic, esriRequest, PictureMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol, Units, 
    LRSTask, utils, nls, esriBundle
) {
    var MapManager = declare([], {
        nls: null,
        lrsMapLayerConfig: null,
        lrsServiceConfig: null,
        lrsServiceTask: null,
        lrsServiceUrl: null,
        map: null,
        pointZoomLevel: 16, // if pointZoomLevel is a config parameter, this will be overridden
        toggleButtonManager: null,
        tolerancePixels: 5,  // tolerance for map clicks/selections (in pixels)
        measurePrecision: null,
        
        // symbols
        _lineSelectionSymbol: null,
        _lineFlashSymbol: null,
        _fromMeasureSymbol: null,
        _toMeasureSymbol: null,
        _pointClickSymbol: null,
        
        _originalAddPointTooltip: null,
        
        constructor: function() {
            this.nls = nls;
            this.toggleButtonManager = new ToggleButtonManager();
            this._originalAddPointTooltip = esriBundle.toolbars.draw.addPoint;
        },
        
        /*
         * Find the lrs service in the map and load the lrs metadata.
         */
        loadLrs: function(webmap) {
            var defd = new Deferred;
            this._findLrsService(webmap.webMapResponse.itemInfo).then(lang.hitch(this, function() {
                defd.resolve();
            }), lang.hitch(this, function(err) {
                defd.reject(err);
            }));
            return defd;
        },
        
        /*
         * Graphic symbols getters and setters
         */
        getLineSelectionSymbol: function() {
            return this.getLineSymbol("_lineSelectionSymbol");
        },
        
        getLineFlashSymbol: function() {
            return this.getLineSymbol("_lineFlashSymbol");
        },
        
        getFromMeasureSymbol: function() {
            return this.getPointSymbol("_fromMeasureSymbol");
        },
        
        getToMeasureSymbol: function() {
            return this.getPointSymbol("_toMeasureSymbol");
        },
        
        getPointClickSymbol: function() {
            return this.getPointSymbol("_pointClickSymbol");
        },
        
        setLineSelectionSymbol: function(symbol) {
            this._setLineSymbol(symbol, "_lineSelectionSymbol");
        },
        
        setLineFlashSymbol: function(symbol) {
            this._setLineSymbol(symbol, "_lineFlashSymbol");
        },
        
        setFromMeasureSymbol: function(symbol) {
            this._setPointSymbol(symbol, "_fromMeasureSymbol");
        },
        
        setToMeasureSymbol: function(symbol) {
            this._setPointSymbol(symbol, "_toMeasureSymbol");
        },
        
        setPointClickSymbol: function(symbol) {
            this._setPointClickSymbol(symbol, "_pointClickSymbol");
        },
        
        /*
         * Centers and zooms to the start point of a line.
         */
        zoomStartPoint: function(geometry) {
            if (geometry && geometry.paths) {
                var point = new Point(utils.first(utils.first(geometry.paths)), this.map.spatialReference);
                this._centerAndZoom(point);
            }
        },
        
        /*
         * Centers and zooms to the end point of a line.
         */
        zoomEndPoint: function(geometry) {
            if (geometry && geometry.paths) {
                var point = new Point(utils.last(utils.last(geometry.paths)), this.map.spatialReference);
                this._centerAndZoom(point);
            }
        },
        
        /*
         * Zooms the map to a geometry.
         */
        zoom: function(geometry) {
            if (geometry.type === "point") {
                this._centerAndZoom(geometry);
            } else if (geometry.type === "multipoint" || geometry.type === "polyline" || geometry.type === "polygon" || geometry.type === "extent") {
                var extent = geometry.getExtent();
                this.map.setExtent(extent.expand(1.1), true);
            }
        },
        
        /*
         * Pans the map to a geometry.
         */
        pan: function(geometry) {
            var centerPoint = null;
            if (geometry.type === "point") {
                centerPoint = geometry;
            } else if (geometry.type === "multipoint" || geometry.type === "polyline" || geometry.type === "polygon" || geometry.type === "extent") {
                var extent = geometry.getExtent();
                centerPoint = extent.getCenter();
            }
            if (centerPoint) {
                this.map.centerAt(centerPoint);
            }
        },
        
        /*
         * Centers and zooms to the point.
         */
        _centerAndZoom: function(point) {
            this.map.centerAndZoom(point, this.pointZoomLevel);
        },
        
        /*
         * Flashes a graphic on the map using the given time interval (or default of 500 milliseconds).
         */
        flash: function(graphicOrGeometry, /*Number*/ intervalInMilliseconds, /*Symbol*/ flashSymbol, /*Number*/ flashCount) {
            // Determine whether the parameter is a Graphic or a Geometry subclass
            var geometry = (graphicOrGeometry.geometry != null) ? graphicOrGeometry.geometry : graphicOrGeometry;
            
            //flash the graphic
            var symbol = flashSymbol ? flashSymbol : this._getDefaultFlashSymbol(geometry);
            if (symbol == null) {
                return;
            }
            var graphicCopy = new Graphic(geometry, symbol);
            
            //use default if not passed in
            intervalInMilliseconds = (typeof intervalInMilliseconds === 'number') ? intervalInMilliseconds : 500;
            flashCount = (typeof flashCount === 'number') ? flashCount : 3;
            
            var flashAgain = lang.hitch(this, function() {
                this.map.graphics.add(graphicCopy);
                setTimeout(lang.hitch(this, function() {
                    this.map.graphics.remove(graphicCopy);
                    flashCount--;
                    if (flashCount > 0) {
                        setTimeout(flashAgain, intervalInMilliseconds);
                    }
                }), intervalInMilliseconds);
            });
            
            flashAgain();
        },
        
        /*
         * Sets the tooltip displayed when the draw toolbar is set to draw a point.
         */
        setAddPointTooltip: function(message) {
            esriBundle.toolbars.draw.addPoint = message;
        },
        
        /*
         * Sets the tooltip displayed when the draw toolbar is set to draw a point to the jsapi default.
         */
        resetAddPointTooltip: function() {
            esriBundle.toolbars.draw.addPoint = this._originalAddPointTooltip;
        },
        
        /*
         * Returns the map's base layer, which controls properties of the map
         * such as units and tile LODs.
         */
        getBaseLayer: function() {
            var map = this.map;
            if (map && map.layerIds && map.layerIds.length > 0 ) {
                return map.getLayer(map.layerIds[0]);
            }
            return null;
        },
        
        /*
         * Returns the units of the map based on the map's base layer.
         * Returns Units.UNKNOWN if the units cannot be determined.
         */
        getMapUnits: function() {
            return this._getLayerUnits(this.getBaseLayer());
        },
        
        _getLayerUnits: function(layer) {
            if (layer) {
                // Layer types: OpenStreetMapLayer, VETiledLayer
                switch (layer.declaredClass) {
                    case "esri.layers.OpenStreetMapLayer":
                    case "esri.virtualearth.VETiledLayer":
                        return Units.METERS;
                }
                // Layer types: ArcGISDynamicMapServiceLayer, ArcGISTiledMapServiceLayer
                if (layer.units 
                    && (typeof layer.units === "string")
                    && layer.units.indexOf("esri") === 0
                ) {
                    return layer.units;
                }
            }
            return Units.UNKNOWN;
        },
        
        _getDefaultFlashSymbol: function(geometry) {
            var defaultSymbol = null;
            var color = new Color([0,100,0]); // dark green
            if (geometry.type === "polyline") {
                defaultSymbol = this.getLineFlashSymbol();
            } else if (geometry.type === "point") {
                var markerOutline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 1);
                defaultSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10, markerOutline, color);
            } else if (geometry.type === "polygon") {
                defaultSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, null, color);
            } else {
                console.log("MapManager has no default symbol for " + graphicFeature.type + ".");
            }
            return defaultSymbol;
        },
        
        _findLrsService: function(webmapItem) {
            var defd = new Deferred();
            var defds = [];
            var candidates = [];
            var hasAuthError = false;
            if (webmapItem.itemData) {
                array.forEach(webmapItem.itemData.operationalLayers, function(layer, layerIndex) {
                    if (layer && layer.url && layer.url.match(/\/MapServer[\/]?$/i)) {
                        var defdLayer = new Deferred();
                        defds.push(defdLayer);
                        // Check if the map service is LRS-enabled
                        var params = { f: "json" };
                        esriRequest({
                            url: layer.url, content: params, callbackParamName: "callback"
                        }).then(lang.hitch(this, function(json) {
                            if (json && json.supportedExtensions) {
                                if (array.indexOf(json.supportedExtensions.split(", "), "LRSServer") > -1) {
                                    // This is a valid LRS map service
                                    candidates.push({ layer: layer, layerIndex: layerIndex, lrsConfig: json, lrsUrl: layer.url + "/exts/LRSServer"});
                                }
                            }
                            defdLayer.resolve();
                        }), lang.hitch(this, function(err) {
                            if (err && err.code) {
                                if (err.code === 403 || err.code === 499 || err.code === 401) {
                                    // Unauthorized access
                                    hasAuthError = true;
                                }
                            }
                            defdLayer.resolve();
                        }));
                    }
                }, this);
            }
            
            // Wait for all services to be inspected
            new DeferredList(defds).then(lang.hitch(this, function() {
                if (candidates.length == 0) {
                    // Either the web map does not contain any LRS-enabled service,
                    // or the user is not authorized to access such a service.
                    if (hasAuthError) {
                        defd.reject({mainMessage: this.nls.noAuthorizedLrsServiceDetected});
                    } else {
                        defd.reject();
                    }
                } else if (candidates.length == 1) {
                    var cand = candidates[0];
                    this.lrsMapLayerConfig = cand.layer;
                    this.lrsServiceUrl = cand.lrsUrl;
                    this.lrsServiceConfig = cand.lrsConfig;
                    this.lrsServiceTask = new LRSTask(this.lrsServiceUrl);
                    this._lookupLrsLayers().then(lang.hitch(this, function() {
                        var hasMultipleWorkspaces = false;
                        var lrsId = null;
                        array.forEach(this.lrsServiceConfig.eventLayers, function(layer) {
                            if (lrsId === null) {
                                lrsId = layer.lrs.id;
                            } else if (lrsId !== layer.lrs.id) {
                                hasMultipleWorkspaces = true;
                            }
                        }, this);
                        if (hasMultipleWorkspaces) {
                            defd.reject({mainMessage: this.nls.tooManyEditWorkspacesDetected});
                            return;
                        }
                        defd.resolve();
                    }), lang.hitch(this, function(err) {
                        err.mainMessage = this.nls.errorGettingLrsLayers;
                        defd.reject(err);
                    }));
                } else {
                    defd.reject({mainMessage: this.nls.tooManyLrsServicesDetected});
                }
            }));
            
            return defd;
        },
        
        /*
         * Loads metadata for all network and event layers in the map service.
         * Returns Deferred.
         */
        _lookupLrsLayers: function() {
            var defd = new Deferred();
            this.lrsServiceTask.getAllLayersInfo().then(lang.hitch(this, function(info) {
                var config = this.lrsServiceConfig;
                config.networkLayers = info.networkLayers || [];
                config.eventLayers = info.eventLayers || [];
                config.redlineLayers = info.redlineLayers || [];
                config.centerlineLayers = info.centerlineLayers || [];
                config.calibrationPointLayers = info.calibrationPointLayers || [];
                config.intersectionLayers = info.intersectionLayers || [];
                config.nonLRSLayers = info.nonLRSLayers || [];
                
                // Filter out external event layers, since they are no longer supported for selection or editing at 10.2
                config.eventLayers = array.filter(config.eventLayers, function(layer) {
                    return !layer.isStaged;
                }, this);
                
                // Fill in defaults for the newer layer metadata properties that weren't exposed at 10.0
                var defaultRouteEventSource = (config.currentVersion < 10.099);
                array.forEach(config.eventLayers, function(layer) {
                    if (layer.isRouteEventSource === undefined) {
                        layer.isRouteEventSource = defaultRouteEventSource;
                    }
                }, this);
                
                // Convenience property containing a flat array of all LRS layers
                config.allLayers = []
                    .concat(config.networkLayers)
                    .concat(config.eventLayers)
                    .concat(config.redlineLayers)
                    .concat(config.centerlineLayers)
                    .concat(config.calibrationPointLayers)
                    .concat(config.intersectionLayers);
                
                defd.resolve();
            }), lang.hitch(this, function(err) {
                defd.reject(err);
            }));
            return defd;
        },
        
        getLineSymbol: function(symbolName) {
            var symbol = this[symbolName];
            if (!symbol) {
                switch(symbolName) {
                    case "_lineSelectionSymbol":
                        symbol = new SimpleLineSymbol({
                            "color": [0, 255, 255, 255],
                            "width": 3,
                            "type": "esriSLS",
                            "style": "esriSLSSolid"
                        });
                        break;
                    case "_lineFlashSymbol":
                        symbol = new SimpleLineSymbol({
                            "color": [0, 100, 0, 255],
                            "width": 3,
                            "type": "esriSLS",
                            "style": "esriSLSSolid"
                        });
                        break;
                    default:
                        symbol = new SimpleLineSymbol(
                            SimpleLineSymbol.STYLE_SOLID, 
                            new Color([255, 174, 0]), 
                            4.0
                        );
                }
            }
            return symbol;
        },
        
        getPointSymbol: function(symbolName) {
            var symbol = this[symbolName];
            if (!symbol) {                
                switch(symbolName) {
                    case "_fromMeasureSymbol":
                        symbol = new SimpleMarkerSymbol({
                            "color": [0, 192, 0, 255],
                            "size": 13.5,
                            "angle": 0,
                            "xoffset": 0,
                            "yoffset": 0,
                            "type": "esriSMS",
                            "style": "esriSMSCross",
                            "outline": {
                                "color": [0, 192, 0, 255],
                                "width": 3,
                                "type": "esriSLS",
                                "style": "esriSLSSolid"
                            }
                        });
                        break;
                    case "_toMeasureSymbol":
                        symbol = new SimpleMarkerSymbol({
                            "color": [255, 0, 0, 255],
                            "size": 12,
                            "angle": 0,
                            "xoffset": 0,
                            "yoffset": 0,
                            "type": "esriSMS",
                            "style": "esriSMSX",
                            "outline": {
                                "color": [255, 0, 0, 255],
                                "width": 3,
                                "type": "esriSLS",
                                "style": "esriSLSSolid"
                            }
                        });
                        break;
                    case "_pointClickSymbol":
                        symbol = new SimpleMarkerSymbol({
                            "color": [255, 255, 0, 255],
                            "size": 10,
                            "angle": 0,
                            "xoffset": 0,
                            "yoffset": 0,
                            "type": "esriSMS",
                            "style": "esriSMSCircle",
                            "outline": {
                                "color": [63, 63, 63, 255],
                                "width": 0.75,
                                "type": "esriSLS",
                                "style": "esriSLSSolid"
                            }
                        });
                        break;
                    default:
                        symbol = new SimpleMarkerSymbol(
                            SimpleMarkerSymbol.STYLE_DIAMOND, 
                            12.0,
                            new SimpleLineSymbol (SimpleLineSymbol.STYLE_SOLID, new Color([255, 174, 0]), 2.0),
                            new Color([255, 211, 128])
                        );
                }
            }
            return symbol;
        },
        
        _setLineSymbol: function(symbol, symbolName) {
            if (symbol) {
                this[symbolName] = new SimpleLineSymbol(symbol);
            } else {
                this[symbolName] = null;
            }
        },
        
        _setPointSymbol: function(symbol, symbolName) {
            if (symbol && symbol.type) {
                if (symbol.type == "esriSMS") {
                    this[symbolName] = SimpleMarkerSymbol(symbol);
                } else {
                    this[symbolName] = PictureMarkerSymbol(symbol);
                }
            } else {
                this[symbolName] = null;
            }
        }
    }); // end MapManager
    
    /*
     * Toggle Button Manager
     * Makes sure that only one toggle button can be selected at a time.
     */
    var ToggleButtonManager = declare([], {
        _toggleBtns: null,
        _eventHandlers: null,
        
        constructor: function() {
            this._toggleBtns = {};
        },
        
        /*
         * Register a toggle button with the manager. 
         * toggleBtn: lrscommon/js/form/ToggleButton
         * Set "manuallyRegisterActivation" to true to manually call "buttonActivated" when the toggle button is activated.
         */
        registerButton: function(toggleBtn, manuallyRegisterActivation) {
            if (!this._toggleBtns[toggleBtn.id]) {
                var obj = { btn: toggleBtn };
                if (!manuallyRegisterActivation) {
                    obj.eventHandler = on(toggleBtn, "change", lang.hitch(this, function(isOn){
                        this._toggleBtnChanged(toggleBtn, isOn);
                    }));
                }
                this._toggleBtns[toggleBtn.id] = obj;
            }
        },
        
        /*
         * Unregister a toggle button.
         * toggleBtn: lrscommon/js/form/ToggleButton
         */
        unregisterButton: function(toggleBtn) {
            var registration = this._toggleBtns[toggleBtn.id];
            if (registration) {
                if (registration.eventHandler) {                    
                    registration.eventHandler.remove();
                    registration.eventHandler = null;
                }
                registration.btn = null;
                this._toggleBtns[toggleBtn.id] = null;
                delete this._toggleBtns[toggleBtn.id];
            }
        },
        
        /*
         * Turns off other toggle buttons when one is turned on.
         */
        buttonActivated: function(toggleBtn) {
            for (btnId in this._toggleBtns) {
                if (btnId != toggleBtn.id) {
                    this._toggleBtns[btnId].btn.turnOff();
                }
            }
        },
        
        _toggleBtnChanged: function(toggleBtn, isOn) {
            if (isOn) {
                this.buttonActivated(toggleBtn);
            }    
        }
        
    }); // end ToggleButtonManager
    
    return MapManager;
});