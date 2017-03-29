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
    "dojo/DeferredList",
    "dojo/on",
    "esri/toolbars/draw",
    "jimu/SelectionManager",
    "./_FormWidgetBase",
    "./RouteComboBox",
    "./ToggleButton",
    "../SelectFeaturePopup",
    "../form/RouteComboBox",
    "../tasks/RouteTask",
    "../tasks/serviceInfoCache",
    "../util/routeName",
    "../util/utils",
    "dojo/text!./templates/RoutePicker.html"
], function(
    array, declare, lang, DeferredList, on, Draw, SelectionManager, _FormWidgetBase, RouteComboBox, ToggleButton,
    SelectFeaturePopup, RouteComboBox, RouteTask, serviceInfoCache, routeNameUtils, utils, template
) {
    
 /*
 * A widget that allows the user to select a route by typing or clicking on the map.
 * Use "getRouteValues()" to get the route the user has selected.
 * Use "setRouteValues()" to programmatically set a selected route.
 */
    
return declare([_FormWidgetBase], {
    templateString: template,
    
    _mapManager: null,
    _routeTask: null,
    _drawToolbar: null,
    _eventHandlers: null,
    makeRouteSelections: true, // if true, will select the route in the feature layer on the map
    networkLayer: null,
    selectionFeatures: null,
    
    // Events
    onRouteValidated: function(isValidRoute, feature) {},
    onRouteInvalidated: function() {},
    onChange: function() {}, // do not get the route values from the on change event since they have not been validated yet
    
    constructor: function() {
        this._eventHandlers = [];
    },
    
    postMixInProperties: function() {
        this.inherited(arguments);
    },
    
    postCreate: function() {
        this.inherited(arguments);
        if (this.required || this.required === "") {
            this._routeInput.set("required", true);
        }
        this.own(
            on(this._routeInput, "routevalidated", lang.hitch(this, function(isValidRoute, feature) {
                this.onRouteValidated(isValidRoute, feature);
                this.selectRoute();
            }))
        );
        this.own(
            on(this._routeInput, "routeinvalidated", lang.hitch(this, function() {
                this.onRouteInvalidated();
                this.clearSelection();
            }))
        );
    },
    
    destroy: function() {
        this._deactivateDraw();
        this._mapManager.toggleButtonManager.unregisterButton(this._chooseRouteButton);
        array.forEach(this._eventHandlers, function(eventHandle) {
            eventHandle.remove();
        }, this);
        this.inherited(arguments);
    },
    
    /*
     * Returns defd that resolves to an object with routeId, routeName, and routeFeature
     * If the route is invalid, these values will be null
     */
    getRouteValues: function() {
        return this._routeInput.getRouteValues();    
    },
    
    _getIsValidRouteAttr: function() {
        return this._routeInput.isValidRoute;
    },
    
    /*
     * Sets the selected route programmatically. If validate is false, it will not validate the provided values.
     * routeValues: {
     *     routeId: <string>
     *     routeName: <string>
     *     routeFeature: feature <esri/Graphic>
     */
    setRouteValues: function(routeValues, validate) {
        this._routeInput.setRouteValues(routeValues, validate);    
    },
    
    /*
     * returns defd with true/false that is resolved after route ID is validated
     */
    setRouteId: function(routeId) {
        return this._routeInput.setRouteId(routeId);
    },
    
    /*
     * Returns the selected route's ID
     * Will return null if the selected route has not been validated.
     */
    getRouteId: function() {
        if (this._routeInput.routeIsValidated) {
            return this._routeInput.routeId;
        } else {
            return null;
        }
    },
    
    _setFromRouteFormAttr: function(val) {
        this.fromRouteForm = val;
        this._routeInput.set("fromRouteForm", val);
    },
    
    _setToRouteFormAttr: function(val) {
        this.toRouteForm = val;
        this._routeInput.set("toRouteForm", val);
    },
    
    /*
     * Deactivate the map selector button
     */
    deactivate: function() {
        this._chooseRouteButton.turnOff();    
        this._deactivateDraw();
    },
    
    /*
     * Activate the map selector button
     */
    activate: function() {
        this._mapManager.toggleButtonManager.buttonActivated(this._chooseRouteButton);
        this._chooseRouteButton.turnOn();   
        this._activateDraw();
    },
    
    _setSelectionFeatures: function(features) {
        this.selectionFeatures = features;
        if (this.networkLayer && this.networkLayer.supportsLines) {            
            if (this.fromRouteForm) {
                this.fromRouteForm.selectionFeatures = features;
            }    
            if (this.toRouteForm) {
                this.toRouteForm.selectionFeatures = features;
            }
        }
    },
    
    /*
     * Select the route on the map
     */
    selectRoute: function() {
        if (this.makeRouteSelections) {
            this._setSelectionFeatures(null);
            if (this.networkLayer && this.networkLayer.supportsLines && (this.fromRouteForm || this.toRouteForm)) {
                this._selectLine();
            } else {                
                this._routeInput.getRouteValues().then(lang.hitch(this, function(routeValues) {
                    if (routeValues && routeValues.routeFeature) {
                        this._setLayerSelection([routeValues.routeFeature]);
                    } else {
                        this.clearSelection();
                    }
                }));
            }
        }    
    },
    
    _selectLine: function() {
        if (this.makeRouteSelections) {
            var otherRouteForm = this.fromRouteForm ? this.fromRouteForm : this.toRouteForm;
            var defds = [
                this._routeInput.getRouteValues(),
                otherRouteForm.getRouteValues()
            ];
            new DeferredList(defds).then(lang.hitch(this, function(responses) {
                var routeValues = responses[0][1];
                var otherRouteValues = responses[1][1];
                if (routeValues && routeValues.routeFeature && otherRouteValues && otherRouteValues.routeFeature && this.get("isValidRoute") && otherRouteForm.get("isValidRoute")) {
                    // both route inputs are populated
                    var lineOrderFieldName = this.networkLayer.lineOrderFieldName;
                    var fromLineOrder = routeValues.routeFeature.attributes[lineOrderFieldName];
                    var toLineOrder = otherRouteValues.routeFeature.attributes[lineOrderFieldName];
                    this._routeTask.getRoutesOnLine(routeValues.lineId, fromLineOrder, toLineOrder, true).then(lang.hitch(this, function(features) {
                        this._setLayerSelection(features);
                    }), lang.hitch(this, function(err) {
                        console.log("Could not select the routes on the line in the map.");
                        console.log(err);
                    }));
                } else if (routeValues && routeValues.routeFeature && this.get("isValidRoute")) {
                    // only this route input is populated
                    this._setLayerSelection([routeValues.routeFeature]);
                } else if (otherRouteValues && otherRouteValues.routeFeature && otherRouteForm.get("isValidRoute")) {
                    // only the other route input is populated
                    this._setLayerSelection([otherRouteValues.routeFeature]);
                } else {
                    this.clearSelection();
                }
            }));  
        }  
    },
    
    _setLayerSelection: function(features) {
        var url = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + this.networkLayer.id);
        var lrsMapId = this._mapManager.lrsMapLayerConfig.id;
        this._setSelectionFeatures(features);
        serviceInfoCache.getAppBuilderLayerObject(url, lrsMapId).then(lang.hitch(this, function(layerObject) {
            var selectionManager = SelectionManager.getInstance();
            layerObject.setSelectionSymbol(this._mapManager.getLineSelectionSymbol());
            selectionManager.clearSelection(layerObject);
            selectionManager.setSelection(layerObject, features);
        }), lang.hitch(this, function(err) {
            console.log("Could not select the route/line on the map.");
            console.log(err);
        }));
    },
    
    /*
     * Clear the routes selected in a specific network
     */
    clearSelection: function(networkLayer) {
        networkLayer = networkLayer || this.networkLayer;
        this._setSelectionFeatures(null);
        if (this.makeRouteSelections && networkLayer && this._mapManager) {
            var url = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + networkLayer.id);
            var lrsMapId = this._mapManager.lrsMapLayerConfig.id;
            serviceInfoCache.getAppBuilderLayerObject(url, lrsMapId).then(lang.hitch(this, function(layerObject) {
                var selectionManager = SelectionManager.getInstance();
                selectionManager.clearSelection(layerObject);
            }), lang.hitch(this, function(err) {
                console.log("Could not clear the route selection from the map.");
                console.log(err);
            }));
        }    
    },
    
    /*
     * Sets the properties required for this widget.
     */
    _setConfigAttr: function(config) {
        this._mapManager = config.mapManager;
        this._routeTask = new RouteTask({
            mapManager: this._mapManager,
            networkLayer: this.networkLayer
        });
        this._drawToolbar = new Draw(this._mapManager.map);
        this._eventHandlers.push(this._drawToolbar.on("draw-end", lang.hitch(this, this._onDrawEnd)));
        this._mapManager.toggleButtonManager.registerButton(this._chooseRouteButton, true);
        this._routeInput.set("config", config);
    },
    
    _setNetworkLayerAttr: function(val) {
        if (val != this.networkLayer) {
            this.clearSelection(this.networkLayer);
            this.networkLayer = val;
            if (this._routeTask) {
                this._routeTask.setNetworkLayer(this.networkLayer);
            }
            this._routeInput.set("networkLayer", this.networkLayer);
        }    
    },
    
    _onChooseRouteButtonChange: function(isOn) {
        if (isOn) {
            this.activate();
        } else {
            this.deactivate();
        }
    },
    
    _activateDraw: function() {
        if (this._drawToolbar) {   
            this._mapManager.setAddPointTooltip(this.nls.selectRouteDrawTooltip);
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
        this._routeTask.getRoutesAtPoint(evt.geometry, true).then(lang.hitch(this, function(featureSet) {
            if (featureSet && featureSet.features && featureSet.features.length > 0) { 
                if (featureSet.features.length == 1) {
                    this._featureSelected({feature: featureSet.features[0]});
                } else {
                    var selectFeaturePopup = new SelectFeaturePopup({
                        mapManager: mapManager,
                        features: featureSet.features,
                        displayField: routeNameUtils.getRouteFieldName(this.networkLayer),
                        displayType: "route"
                    });
                    selectFeaturePopup.showPopup();
                    on.once(selectFeaturePopup, "featureselected", lang.hitch(this, function(feature) {
                        if (feature) {
                            this._featureSelected({feature: feature});
                        }
                    }), this);
                }
            }
        }), lang.hitch(this, function(err) {
            utils.showMessage(this.nls.errorChoosingRouteOnMap + "\n\n" + err.message);
            console.log('roads.widgets.RouteSelector._onDrawEnd(): err=' + err);
        }));
    },
    
    _featureSelected: function(params) {
        var feature = params.feature;
        var networkLayer = this.networkLayer;
        this._routeInput.setRouteValues({
            routeId: feature.attributes[networkLayer.compositeRouteIdFieldName],
            routeName: feature.attributes[networkLayer.routeNameFieldName],
            routeFeature: feature,
            lineId: feature.attributes[networkLayer.lineIdFieldName]
        }, false);
    },
    
    _onRouteInputChange: function() {
        this.onChange();    
    }
});  // end declare
});  // end define
