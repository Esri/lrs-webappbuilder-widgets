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
    "dojo/keys",
    "dojo/number",
    "dojo/on",
    "dijit/MenuItem",
    "../form/NumberValidationTextBox",
    "../form/TextFieldContextMenu",
    "../tasks/RouteTask",
    "../util/i18n",
    "../util/utils",
    "dojo/i18n!../nls/strings"
], function(
    array, declare, lang, Deferred, keys, number, on, MenuItem, NumberValidationTextBox, TextFieldContextMenu, RouteTask, i18nUtils, utils, nls
) {
    /*
     * A specialized validating TextBox control that handles measure values.
     * Formats/rounds values to a precise number of decimal places.
     * A networkLayer and routeId must be set for the measure to be validated.
     */
    return declare([NumberValidationTextBox], {
        nls: null,
        measurePrecision: null, // if not set, it will use the network layer's measure precision
        unlocatable: false,  // whether the measure was located on the route
        isValidMeasure: true,
        measureIsValidated: true,
        measureGeometry: null,
        _mapManager: null,
        _routeInput: null,
        _routeTask: null,
        _networkLayer: null,
        _routeId: null,
        
        
        // Events
        onMeasureValidated: function(isValidMeasure, feature) {},
        onMeasureInvalidated: function() {},
        
        postMixInProperties: function() {
            this.inherited(arguments);
            this.nls = nls;
            this.invalidMessage = this.nls.invalidMeasure;
        },
        
        postCreate: function() {
            this.inherited(arguments);
            this.own(
                on(this, 'keydown', function(evt) {
                    this._setMeasureIsInvalidated();
                    if (evt.keyCode == keys.ENTER) {
                        this.focusNode.blur();
                    } else {
                        // Delay to get the currently entered value from the input
                        setTimeout(lang.hitch(this, function() {
                            this.resetErrorState();
                        }), 1);
                    }
                })
            );
            
            // Attach a context menu to the measure text field
            new TextFieldContextMenu({
                textField: this,
                menuItems: [
                    new MenuItem({
                        label: this.nls.useRouteStart,
                        onClick: lang.hitch(this, "setMeasureToRouteStart")
                    }),
                    new MenuItem({
                        label: this.nls.useRouteEnd,
                        onClick: lang.hitch(this, "setMeasureToRouteEnd")
                    })
                ]
            });
        },
        
        /*
         * Returns defd that resolves to an object with measure, geometry, and valid
         */
        getMeasure: function() {
            var defd = new Deferred();
            
            if (this.measureIsValidated) {
                defd.resolve({measure: this.getNumberValue(), valid: this.isValidMeasure, geometry: this.measureGeometry});
            } else {
                this.validateMeasure();
                on.once(this, "measurevalidated", lang.hitch(this, function() {
                    defd.resolve({measure: this.getNumberValue(), valid: this.isValidMeasure, geometry: this.measureGeometry});  
                }));
            }
            
            return defd;
        },
        
        /*
         * Sets the measure programmatically. If validate is false, it will not validate the measure.
         */
        setMeasure: function(measure, geometry, validate) {
            this.set("value", measure);
            if (validate) {
                this._onBlur();
            } else {
                this.measureGeometry = geometry;
                this.resetErrorState();
                this._setMeasureIsValidated(measure);
            }
        },
        
        /*
         * If a _routeInput is configured, sets the value to the route start
         */
        setMeasureToRouteStart: function() {
            this._setMeasureToRoutePoint("start");
        },
        
        /*
         * If a _routeInput is configured, sets the value to the route end
         */
        setMeasureToRouteEnd: function() {
            this._setMeasureToRoutePoint("end");
        },
        
        /*
         * type = "start" for route start
         * type = "end" for route end
         */
        _setMeasureToRoutePoint: function(type) {
            this._routeInput.getRouteValues().then(lang.hitch(this, function(routeValues) {
                if (routeValues && routeValues.routeId != null) {
                    if (routeValues.routeFeature && routeValues.routeFeature.geometry) {
                        var geom = routeValues.routeFeature.geometry;
                        var routePoint = null;
                        if (type == "start") {
                            // the first point of the first path
                            routePoint = utils.first(utils.first(geom.paths));
                        } else if (type == "end") {
                            // the last point of the last path
                            routePoint = utils.last(utils.last(geom.paths));
                        }
                        if (routePoint && routePoint.length > 2) {
                            this.setMeasure(routePoint[2], null, true);
                        }
                    } else {
                        utils.showMessage(this.nls.useRouteStartEndGeometryError);                    
                    }
                } else {
                    utils.showMessage(this.nls.useRouteStartEndRouteError);
                }
            }));
        },
    
        /*
         * Sets the properties required for this widget.
         */
        _setConfigAttr: function(config) {
            this._mapManager = config.mapManager;
            this._routeTask = new RouteTask({
                mapManager: this._mapManager,
                networkLayer: this._networkLayer
            });
            if (config.routeInput) {
                this.set("routeInput", config.routeInput);
            }
        },
        
        _setRouteInputAttr: function(val) {
            if (val != this._routeInput) { 
                this._routeInput = val;
                this._networkLayer = this._routeInput.networkLayer;
                this.set("value", null);
                this.resetErrorState();
                this.own(
                    on(this._routeInput, 'routevalidated', lang.hitch(this, function(evt) {
                        this.setNetworkAndRoute(this._routeInput.networkLayer, this._routeInput.getRouteId());
                    }))
                ); 
            }
        },
        
        setNetworkAndRoute: function(networkLayer, routeId) {
            if (this._networkLayer != networkLayer || this._routeId != routeId) {
                this._networkLayer = networkLayer;
                
                var precision = this.measurePrecision;
                if (!utils.isValidNumber(precision)) {
                    precision = this._networkLayer ? this._networkLayer.measurePrecision : utils.measurePrecision;
                }
                this.precision = precision;
                
                if (this._routeTask) {
                    this._routeTask.setNetworkLayer(this._networkLayer);
                }
                
                this.setMeasure(null, null, false);
                this._routeId = routeId;
                this.validateMeasure();
            }    
        },
        
        getNetworkLayer: function() {
            return this._networkLayer;
        },
        
        getRouteId: function() {
            return this._routeId;
        },
        
        getRouteInput: function() {
            return this._routeInput;
        },
        
        /*
         * Overrides the function of ValidationTextBox to include check of whether
         * the measure entered is valid.
         */
        validator: function(/*anything*/ value, /*dijit.form.ValidationTextBox.__Constraints*/ constraints) {               
            this.invalidMessage = this.isValidMeasure ? this.nls.invalidMeasure : this.nls.measureNotLocated;
            return this.isValidMeasure && this.inherited(arguments);
        },
        
        /*
         * Validates the measure entered when user tabs away from measure text box 
         * or when the text box is unfocused.
         */
        _onBlur: function() {
            this.inherited(arguments);
            this.validateMeasure();
        },
        
        /*
         * Validates a measure to see if it exists.
         */
        validateMeasure: function() {
            var routeTask = this._routeTask;
            var measure = this.getNumberValue();
            this._setMeasureIsInvalidated();
            if (this._networkLayer && this._routeId && routeTask) {
                if (utils.isValidNumber(measure)) {
                    this._routeTask.isMeasureOnRoute(this._routeId, measure).then(lang.hitch(this, function(response) {
                        if (this._measureEqualsValue(measure)) {
                            if (response.valid) {
                                this.set("isValidMeasure", true);
                                this.measureGeometry = response.geometry;
                            } else {
                                this.set("isValidMeasure", false);
                            }
                            this._setMeasureIsValidated(measure, response);
                        }
                    }), lang.hitch(this, function(err) {
                        utils.showMessage(this.nls.errorValidatingMeasure);
                        console.log("Could not validate the measure.");
                        console.log(err);
                        this.set("isValidMeasure", false);
                        if (this._measureEqualsValue(measure)) {
                            this._setMeasureIsValidated(measure);
                        }
                    }));                      
                } else {
                    this.set("isValidMeasure", true);
                    this._setMeasureIsValidated(measure);
                }
            } else {
                this.set("isValidMeasure", true);
                this._setMeasureIsValidated(measure);
            }
        },
        
        _setMeasureIsInvalidated: function() {
            this.measureGeometry = null;
            if (this.measureIsValidated) {            
                this.measureIsValidated = false;
                this.onMeasureInvalidated();
            }
        },
        
        _setMeasureIsValidated: function(measure, feature) {
            if (this._measureEqualsValue(measure)) {
                this.measureIsValidated = true;
                this.onMeasureValidated(this.isValidMeasure, feature);
            }    
        },
        
        _setIsValidMeasureAttr: function(val) {
            this.isValidMeasure = val;
            this.validate();  
        },
        
        /*
         * This shows the invalid messages and highlights textbox.
         */
        _setErrorState: function(message) {
            if (this.getNumberValue().length > 0) {
                this.isValidMeasure = false;
                this.validate();
            }         
        },
    
        /*
         * Resets the state of a measure text box to remove invalid messages and 
         * text box highlight.
         */
        resetErrorState: function() {
            this.isValidMeasure = true;
            var temp = this.required;
            this.required = false;
            this.validate();
            this.required = temp;
        },
        
        getRouteTask: function() {
            return this._routeTask;    
        },
        
        _measureEqualsValue: function(measure) {
            var currentValue = this.getNumberValue();
            if (utils.isValidNumber(measure) && utils.isValidNumber(currentValue)) {
                return this.formatNumber(measure) == this.formatNumber(currentValue);    
            } else if ((!utils.isValidNumber(measure)) && !utils.isValidNumber(currentValue)) {
                return true;
            }
            return false;
        }
    });
});  // end define
