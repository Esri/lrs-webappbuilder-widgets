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
    "dojo/on",
    "esri/geometry/mathUtils",
    "esri/geometry/Point",
    "esri/graphic",
    "esri/toolbars/draw",
    "jimu/SelectionManager",
    "./_FormWidgetBase",
    "./RouteComboBox",
    "./ToggleButton",
    "../SelectFeaturePopup",
    "../form/MeasureValidationTextBox",
    "../tasks/serviceInfoCache",
    "../util/routeName",
    "../util/utils",
    "dojo/text!./templates/MeasurePicker.html"
], function(
    array, declare, lang, on, geometryMathUtils, Point, Graphic, Draw, SelectionManager, _FormWidgetBase, RouteComboBox, ToggleButton,
    SelectFeaturePopup, MeasureValidationTextBox, serviceInfoCache, routeNameUtils, utils, template
) {
    
 /*
 * A widget that allows the user to select a measure by typing or clicking on the map.
 * Use "getMeasure()" to get the measure the user has selected.
 * Use "setMeasure()" to programmatically set a selected measure.
 */
    
return declare([_FormWidgetBase], {
    templateString: template,
    
    _mapManager: null,
    _drawToolbar: null,
    _eventHandlers: null,
    selectionSymbol: null,
    makeMeasureSelections: true, // if true, will add a graphic to the map
    
    // Events
    onMeasureValidated: function(isValidMeasure, feature) {},
    onMeasureInvalidated: function() {},
    
    constructor: function() {
        this._eventHandlers = [];
    },
    
    postMixInProperties: function() {
        this.inherited(arguments);
    },
    
    postCreate: function() {
        this.inherited(arguments);
        this.own(
            on(this._measureInput, "measurevalidated", lang.hitch(this, function(isValidMeasure, feature) {
                this.onMeasureValidated(isValidMeasure, feature);
                this.selectMeasure();
            }))
        );
        this.own(
            on(this._measureInput, "measureinvalidated", lang.hitch(this, function() {
                this.onMeasureInvalidated();
                this.clearSelection();
            }))
        );
    },
    
    destroy: function() {
        this._deactivateDraw();
        this._mapManager.toggleButtonManager.unregisterButton(this._chooseMeasureButton);
        array.forEach(this._eventHandlers, function(eventHandle) {
            eventHandle.remove();
        }, this);
        this.inherited(arguments);
    },
    
    /*
     * Returns defd that resolves to an object with measure, geometry, and valid
     */
    getMeasure: function() {
        return this._measureInput.getMeasure();    
    },
    
    /*
     * Sets the measure programmatically. If validate is false, it will not validate the provided measure.
     */
    setMeasure: function(measure, validate) {
        this._measureInput.setMeasure(measure, validate);    
    },
    
    /*
     * Deactivate the map selector button
     */
    deactivate: function() {
        this._chooseMeasureButton.turnOff();    
        this._deactivateDraw();
    },
    
    /*
     * Activate the map selector button
     */
    activate: function() {
        this._mapManager.toggleButtonManager.buttonActivated(this._chooseMeasureButton);
        this._chooseMeasureButton.turnOn();   
        this._activateDraw();
    },
    
    /*
     * Select the measure on the map
     */
    selectMeasure: function() {
        if (this.makeMeasureSelections) {
            this._measureInput.getMeasure().then(lang.hitch(this, function(measureObj) {
                if (measureObj && measureObj.valid) {
                    this.clearSelection();
                    var symbol = this.selectionSymbol || this._mapManager.getPointSymbol();
                    this._graphic = new Graphic(measureObj.geometry, symbol);
                    this._mapManager.map.graphics.add(this._graphic);
                }
            }));
        }    
    },
    
    /*
     * Clear the measure graphic from the map
     */
    clearSelection: function() {
        if (this._graphic) {
            this._mapManager.map.graphics.remove(this._graphic);
        }   
    },
    
    /*
     * Sets the properties required for this widget.
     */
    _setConfigAttr: function(config) {
        this._mapManager = config.mapManager;
        this._drawToolbar = new Draw(this._mapManager.map);
        this._eventHandlers.push(this._drawToolbar.on("draw-end", lang.hitch(this, this._onDrawEnd)));
        this._mapManager.toggleButtonManager.registerButton(this._chooseMeasureButton, true);
        this._measureInput.set("config", config);
    },
    
    _setRouteInputAttr: function(val) {
        this.clearSelection();
        this._measureInput.set("routeInput", val);    
    },
    
    _setMeasurePrecisionAttr: function(val) {
        this._measureInput.set("measurePrecision", val);    
    },
    
    setNetworkAndRoute: function(networkLayer, routeId) {
        this._measureInput.setNetworkAndRoute(networkLayer, routeId);    
    },
    
    _onChooseMeasureButtonChange: function(isOn) {
        if (isOn) {
            this.activate();
        } else {
            this.deactivate();
        }
    },
    
    _activateDraw: function() {
        if (this._drawToolbar) {   
            this._mapManager.setAddPointTooltip(this.nls.selectMeasureDrawTooltip);
            this._drawToolbar.activate(Draw.POINT);
        }
    },
    
    _deactivateDraw: function() {
        if (this._drawToolbar) {    
            this._mapManager.resetAddPointTooltip();  
            this._drawToolbar.deactivate();
        }
    },
    
    _onDrawEnd: function(evt) {
        var mapManager = this._mapManager;
        mapManager.flash(evt.geometry, null, mapManager.getPointClickSymbol(), 1);
        
        var map = mapManager.map;
        var mapPoint = evt.geometry;
        var routeId = this._measureInput.getRouteId();
        var networkLayer = this._measureInput.getNetworkLayer();
        var tolerance = mapManager.tolerancePixels * (map.extent.getWidth() / map.width);
        var params = {
            locations: [{
                routeId: routeId,
                geometry: {
                    x: mapPoint.x,
                    y: mapPoint.y
                }
            }],
            tolerance: tolerance,
            inSR: map.spatialReference.toJson()
        };
            
        this._mapManager.lrsServiceTask.geometryToMeasure(networkLayer.id, params).then(lang.hitch(this, function(response) {
            var resultLocation = response.locations[0];
            if (resultLocation.results && resultLocation.results.length > 0) {
                if (resultLocation.results.length == 1) {
                    this._continueLocatePoint(mapPoint, resultLocation.results);
                } else {
                    var routeIds = [];
                    array.forEach(resultLocation.results, lang.hitch(this, function(result) {
                        if (array.indexOf(routeIds, result.routeId) == -1) {
                            routeIds.push(result.routeId);
                        }
                    }));
                    if (routeIds.length > 1) {
                        // no route ID was choosen, so let the user pick the route first
                        var routeTask = this._measureInput.getRouteTask();
                        routeTask.getRoutesAtPoint(mapPoint, true).then(lang.hitch(this, function(featureSet) {
                            if (featureSet && featureSet.features && featureSet.features.length > 0) {
                                var features = featureSet.features;
                                if (features.length == 1) {
                                    resultLocation.results = array.filter(resultLocation.results, function(result) {
                                        return result.routeId == features[0].attributes[networkLayer.compositeRouteIdFieldName];
                                    }, this);
                                    this._continueLocatePoint(mapPoint, resultLocation.results);
                                } else {
                                    var selectFeaturePopup = new SelectFeaturePopup({
                                        mapManager: this._mapManager,
                                        features: features,
                                        displayField: routeNameUtils.getRouteFieldName(networkLayer),
                                        displayType: "route"    
                                    });
                                    selectFeaturePopup.showPopup();
                                    on.once(selectFeaturePopup, "featureselected", lang.hitch(this, function(feature) {
                                        if (feature) {                                            
                                            var userSelectedRouteId = feature.attributes[networkLayer.compositeRouteIdFieldName];
                                            resultLocation.results = array.filter(resultLocation.results, function(result) {
                                                return result.routeId == userSelectedRouteId;
                                            }, this);
                                            this._continueLocatePoint(mapPoint, resultLocation.results);
                                        }
                                    }), this);
                                }
                            }
                        }), lang.hitch(this, function(err) {
                            var message = this.nls.errorChoosingMeasureOnMap;
                            if (err && err.message) {
                                message += "\n\n" + err.message;
                            }
                            utils.showMessage(message);
                            console.log('roads.widgets.RouteSelector._onDrawEnd(): err=' + err);
                        }));
                    } else {
                        this._continueLocatePoint(mapPoint, resultLocation.results);
                    }
                }
            }
        }), lang.hitch(this, function(err) {
            var message = this.nls.errorChoosingMeasureOnMap;
            if (err && err.message) {
                message += "\n\n" + err.message;
            }
            utils.showMessage(message);
            console.log('roads.widgets.RouteSelector._onDrawEnd(): err=' + err);
        }));
    },
    
    _continueLocatePoint: function(mapPoint, results) {
        if (results && results.length > 0) {
            var nearestResult = results[0];
            var nearestDistance = null;
            array.forEach(results, function(result) {
                if (!result.geometry) {
                    return;
                }
                result.geometry = new Point(result.geometry);
                
                var dist = geometryMathUtils.getLength(mapPoint, result.geometry);
                if (nearestDistance == null || dist < nearestDistance) {
                    nearestDistance = dist;
                    nearestResult = result;
                }
            }, this);
                        
            var routeInput = this._measureInput.getRouteInput();
            if (!this._measureInput.getRouteId() && routeInput) {
                routeInput.setRouteId(nearestResult.routeId).then(lang.hitch(this, function(valid) {
                    this._measureInput.setMeasure(nearestResult.measure, nearestResult.geometry, false);
                }));
            } else {
                this._measureInput.setMeasure(nearestResult.measure, nearestResult.geometry, false);
            }
        }
    }
});  // end declare
});  // end define
