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
    "dojo/_base/lang",
    "dojo/Deferred",
    "dojo/DeferredList",
    "dojo/dom-attr",
    "dojo/dom-style",
    "dojo/string",
    "dijit/form/Select",
    "jimu/SelectionManager",
    "esri/graphicsUtils",
    "./lrscommon/js/form/MeasurePicker",
    "./lrscommon/js/form/RoutePicker",
    "./lrscommon/js/LrsWidget",
    "./lrscommon/js/tasks/serviceInfoCache",
    "./lrscommon/js/util/geometry",
    "./lrscommon/js/util/routeName",
    "./lrscommon/js/util/utils"
], function(
    array, declare, lang, Deferred, DeferredList, domAttr, domStyle, string, Select, SelectionManager, 
    graphicsUtils, MeasurePicker, RoutePicker, LrsWidget, serviceInfoCache, geometryUtils, routeNameUtils, utils
) {
    return declare([LrsWidget], {

        baseClass: 'jimu-widget-lrswidget',
        _networkLayer: null,
        
        _onLrsLoaded: function() {
            this._setRouteInputConfig();
            this._setMeasureInputConfig();
            this._populateNetworkSelect();
            this.showContent();
        },
        
        _setRouteInputConfig: function() {
            array.forEach([this._fromRouteInput, this._toRouteInput], function(routeInput) {
                routeInput.set("config", {
                    mapManager: this._mapManager   
                });
            }, this);  
            this._toRouteInput.set("fromRouteForm", this._fromRouteInput);
            this._fromRouteInput.set("toRouteForm", this._toRouteInput);
        },
        
        _setMeasureInputConfig: function() {
            this._fromMeasureInput.set("config", {
                mapManager: this._mapManager,
                routeInput: this._fromRouteInput
            }); 
            this._fromMeasureInput.set("selectionSymbol", this._mapManager.getFromMeasureSymbol());
            this._fromMeasureInput.set("measurePrecision", this._mapManager.measurePrecision);
            
            this._toMeasureInput.set("config", {
                mapManager: this._mapManager,
                routeInput: this._toRouteInput
            }); 
            this._toMeasureInput.set("selectionSymbol", this._mapManager.getToMeasureSymbol());
            this._toMeasureInput.set("measurePrecision", this._mapManager.measurePrecision);
        },
        
        _populateNetworkSelect: function() {
            this._networkSelect.removeOption(this._networkSelect.getOptions());
            var networkLayers = this._mapManager.lrsServiceConfig.networkLayers;
            var options = [];
            array.forEach(networkLayers, function(networkLayer) {
                options.push({
                    label: networkLayer.name,
                    value: networkLayer.id.toString()
                });
            });
            this._networkSelect.addOption(options);
            this._onNetworkSelectChange();
        },
        
        _onNetworkSelectChange: function() {
            var networkLayer = utils.findLayer(this._networkSelect.get("value"), this._mapManager.lrsServiceConfig.networkLayers);
            if (networkLayer && networkLayer != this._networkLayer) {
                this.set("networkLayer", networkLayer);
            }
        },
        
        _setNetworkLayerAttr: function(val) {
            if (this._networkLayer != val) {                
                this._networkLayer = val;
                this._makeNetworkLayerVisible();
                this._fromRouteInput.set("networkLayer", this._networkLayer);
                if (this._networkLayer.supportsLines) {
                    this._toRouteInput.makeRouteSelections = true;
                    this._toRouteInput.set("networkLayer", this._networkLayer);
                    this._toMeasureInput.set("routeInput", this._toRouteInput);
                    domStyle.set(this._toRouteDiv, "display", "table-row");
                    domAttr.set(this._fromRouteLabel, "innerHTML", routeNameUtils.getFromRouteLabel(this._networkLayer));
                    domAttr.set(this._toRouteLabel, "innerHTML", routeNameUtils.getToRouteLabel(this._networkLayer));
                } else {
                    this._toRouteInput.clearSelection();
                    this._toMeasureInput.set("routeInput", this._fromRouteInput);
                    this._toRouteInput.makeRouteSelections = false;
                    this._toRouteInput.deactivate();
                    this._toRouteInput.setRouteValues({
                        routeId: null,
                        routeName: null,
                        routeFeature: null
                    }, false);
                    domStyle.set(this._toRouteDiv, "display", "none");
                    domAttr.set(this._fromRouteLabel, "innerHTML", routeNameUtils.getRouteLabel(this._networkLayer));
                }
                domAttr.set(this._fromMeasureLabel, "innerHTML", string.substitute(this.nls.fromMeasureWithUnits, [utils.getUnitsString(this._networkLayer.unitsOfMeasure, true)]));
                domAttr.set(this._toMeasureLabel, "innerHTML", string.substitute(this.nls.toMeasureWithUnits, [utils.getUnitsString(this._networkLayer.unitsOfMeasure, true)]));
            }
        },
        
        /*
         * Makes the selected network layer visible on the map if it isn't already
         */
        _makeNetworkLayerVisible: function() {
            var lrsMapLayer = this._mapManager.lrsMapLayerConfig ? this._mapManager.lrsMapLayerConfig.layerObject : null;
            var networkLayer = this._networkLayer;
            if (lrsMapLayer && networkLayer) {
                var visibleLayers = lrsMapLayer.visibleLayers ? lrsMapLayer.visibleLayers.slice() : [];
                var networkLayerVisible = array.some(visibleLayers, function(layer) {
                    return layer == networkLayer.id;
                }, this);
                if (!networkLayerVisible) {
                    visibleLayers.push(networkLayer.id);
                    lrsMapLayer.setVisibleLayers(visibleLayers);
                }
            } else {
                var message = "Could not set the visiblity of the choosen network layer.";
                if (!lrsMapLayer) {
                    message += " No LRS map layer.";
                } else if (!networkLayer){
                    message += " No network layer.";
                }
                console.log(message);
            }
        },
        
        _pan: function() {
            this._panOrZoom("pan");
        },
        
        _zoom: function() {
            this._panOrZoom("zoom");
        },
        
        _panOrZoom: function(type) {
            this.showBusy();
            var mapFunc = type == "pan" ? lang.hitch(this._mapManager, this._mapManager.pan) : lang.hitch(this._mapManager, this._mapManager.zoom);
            var defds = [this._fromRouteInput.getRouteValues()];
            if (this._networkLayer && this._networkLayer.supportsLines) {
                defds.push(this._toRouteInput.getRouteValues());
            }
            new DeferredList(defds).then(lang.hitch(this, function(responses) {
                var fromRouteValues = responses[0][1];
                var toRouteValues = responses.length > 1 ? responses[1][1] : null;
                if (this._areRoutesValid(fromRouteValues, toRouteValues)) {
                    var defds = [
                        this._fromMeasureInput.getMeasure(),
                        this._toMeasureInput.getMeasure()
                    ];
                    new DeferredList(defds).then(lang.hitch(this, function(responses) {
                        this.hideBusy();
                        var fromMeasureValues = responses[0][1];
                        var toMeasureValues = responses[1][1];  
                        if (this._areMeasuresValid(fromMeasureValues, toMeasureValues) && this._areToInputsValid(toRouteValues, toMeasureValues, fromMeasureValues)) {
                            var fromRouteId = fromRouteValues.routeId;
                            var toRouteId = toRouteValues ? toRouteValues.routeId : null;
                            var fromMeasure = fromMeasureValues.measure;
                            var toMeasure = toMeasureValues.measure;
                            if (utils.isValidNumber(fromMeasure) && utils.isValidNumber(toMeasure)) {
                                // both measures so zoom to from/to measure section
                                this.showBusy();
                                this._getPartialRoute(fromRouteId, toRouteId, fromMeasure, toMeasure).then(lang.hitch(this, function(geom) {
                                    this.hideBusy();
                                    mapFunc(geom);
                                }), lang.hitch(this, function(err) {
                                    this.hideBusy();
                                    this.showMessage(this.nls.noMeasuresGeometry);
                                    console.log(err);
                                }));
                            } else if (utils.isValidNumber(fromMeasure)) {
                                // no to measure so zoom to from measure
                                mapFunc(fromMeasureValues.geometry);
                            } else if (utils.isValidNumber(toMeasure)) {
                                // no from measure so zoom to to measure
                                mapFunc(toMeasureValues.geometry);
                            } else {
                                // no measure so zoom to route
                                var geom = null;
                                if (toRouteId != null) {
                                    if (this._fromRouteInput.selectionFeatures && this._fromRouteInput.selectionFeatures.length > 0) {
                                        geom = graphicsUtils.graphicsExtent(this._fromRouteInput.selectionFeatures);
                                    }
                                } else {
                                    geom = fromRouteValues.routeFeature ? fromRouteValues.routeFeature.geometry : null;
                                }
                                if (geom) {
                                    mapFunc(geom);
                                } else {
                                    this.showMessage(this.nls.noGeometry);
                                }
                            }
                        } else {
                            this.hideBusy();
                        }
                    }));
                } else {
                    this.hideBusy();
                }
            }));
        },
        
        _areRoutesValid: function(fromRouteValues, toRouteValues) {
            var fromInvalid = fromRouteValues == null || fromRouteValues.routeId == null || fromRouteValues.routeId == undefined;
            if (fromInvalid) {
                if (this._networkLayer.supportsLines) {
                    this.showMessage(this.nls.enterFromRoute);
                } else {
                    this.showMessage(this.nls.enterRoute);
                }
                return false;
            }
            
            if (this._networkLayer.supportsLines) {
                var toInvalid = !this._toRouteInput.get("isValidRoute");
                if (toInvalid) {
                    this.showMessage(this.nls.invalidToRoute);
                    return false;
                }
            }  
            
            return true;
        },
        
        _areMeasuresValid: function(fromMeasureValues, toMeasureValues) {
            var fromInvalid = (utils.isValidNumber(fromMeasureValues.measure) && !fromMeasureValues.valid);
            var toInvalid = (utils.isValidNumber(toMeasureValues.measure) && !toMeasureValues.valid);  
            if (fromInvalid && toInvalid) {
                this.showMessage(this.nls.invalidFromAndToMeasures);
                return false;
            } else if (fromInvalid) {
                this.showMessage(this.nls.invalidFromMeasure);
                return false;
            } else if (toInvalid) {
                this.showMessage(this.nls.invalidToMeasure);
                return false;
            }
            return true;
        },
        
        _areToInputsValid: function(toRouteValues, toMeasureValues, fromMeasureValues) {
            var message = null;
            if (toRouteValues) {                
                var toMeasureProvided = utils.isValidNumber(toMeasureValues.measure);
                var fromMeasureProvided = utils.isValidNumber(fromMeasureValues.measure);
                var toRouteProvided = toRouteValues.routeId != null;
                if (toMeasureProvided && !toRouteProvided) {
                    message = this.nls.invalidToLocation;
                } else if (toMeasureProvided && toRouteProvided && !fromMeasureProvided) {
                    message = this.nls.invalidLineFromAndToMeasure;
                } else if (fromMeasureProvided && toRouteProvided && !toMeasureProvided) {
                    message = this.nls.invalidToLocation;
                }
            }
            if (message) {
                this.showMessage(message);
                return false;
            }
            return true;
        },
        
        _getPartialRoute: function(routeId, toRouteId, fromMeasure, toMeasure) {
            var defd = new Deferred();
            var map = this._mapManager.map;
            var networkLayer = this._networkLayer;
            var location = { 
                routeId: routeId,
                fromMeasure: fromMeasure,
                toMeasure: toMeasure
            };
            if (toRouteId) {
                location.toRouteId = toRouteId;
            }
            var params = {
                locations: [location],
                outSR: map.spatialReference.toJson()
            };
                
            this._mapManager.lrsServiceTask.measureToGeometry(networkLayer.id, params).then(lang.hitch(this, function(response) {
                var foundLocation = null;
                if (response && response.locations && response.locations.length > 0) {
                    foundLocation = utils.first(response.locations, function(loc) {
                        return loc.status === "esriLocatingOK";
                    }, this);
                }
                if (foundLocation) {
                    defd.resolve(geometryUtils.create(foundLocation));
                } else {
                    defd.reject("No full matches found");
                }
            }), lang.hitch(this, function(err) {
                defd.reject(err);
            }));
            return defd;
        },
        
        onClose: function() {
            this._fromMeasureInput.setMeasure(null, null, false);
            this._toMeasureInput.setMeasure(null, null, false);
            this._toRouteInput.setRouteValues({}, false);
            this._fromRouteInput.setRouteValues({}, false);
        }
        
    });
});