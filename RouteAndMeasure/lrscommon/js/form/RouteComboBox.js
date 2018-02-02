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
    "dojo/dom-style",
    "dojo/keys",
    "dojo/on",
    "dojo/string",
    "dojo/store/Memory",
    "dijit/form/ComboBox",
    "../tasks/RouteTask",
    "../util/routeName",
    "../util/utils",
    "dojo/i18n!../nls/strings"
], function(
    array, declare, lang, Deferred, domStyle, keys, on, string, Memory, ComboBox, 
    RouteTask, routeNameUtils, utils, nls
) {
    
/*
 * A widget that allows the user to select a route by typing.
 * Use "getRouteValues()" to get the route the user has selected.
 * Use "setRouteValues()" to programmatically set a selected route.
 */
    
return declare([ComboBox], {
    autoComplete: false,
    keepOpen: false,
    
    minKeyCount: 1, // characters typed before intellisense kicks in
    maxRecordCount: 10, // max number of options to display in intellisense dropdown
    nls: null,
    networkLayer: null,
    routeId: null,
    routeName: null,
    routeFeature: null,
    lineId: null,
    isValidRoute: true,
    routeNameField: null,
    routeIsValidated: true,
    fromRouteForm: null,
    toRouteForm: null,
    _mapManager: null,
    _routeTask: null,
    _populatingOptions: false,
    
    // Events
    onRouteValidated: function(isValidRoute, feature) {},
    onRouteInvalidated: function() {},
    
    constructor: function() {
        this.searchAttr = "name";  
    },
    
    postMixInProperties: function() {
        this.inherited(arguments);
        this.nls = nls;
        this.invalidMessage = this.nls.invalidRoute;
    },
    
    postCreate: function() {
        this.inherited(arguments);
        this.own(
            on(this, 'keydown', function(evt) {
                this._setRouteIsInvalidated();
                if (evt.keyCode == keys.ENTER) {
                    this.focusNode.blur();
                } else {
                    // Delay to get the currently entered value from the input
                    setTimeout(lang.hitch(this, function() {
                        this.resetErrorState();
                        this.populateOptions();
                    }), 1);
                }
            })
        );
    },
    
    startup: function() {
        this.inherited(arguments);
        this._setDropDownButtonState();
    },
    
    /*
     * Returns defd that resolves to an object with routeId, routeName, and routeFeature
     * If the route is invalid, these values will be null
     */
    getRouteValues: function() {
        var defd = new Deferred();
        
        if (this.routeIsValidated) {
            defd.resolve({routeId: this.routeId, routeName: this.routeName, routeFeature: this.routeFeature, lineId: this.lineId});
        } else {
            this.validateRoute();
            on.once(this, "routevalidated", lang.hitch(this, function() {
                defd.resolve({routeId: this.routeId, routeName: this.routeName, routeFeature: this.routeFeature, lineId: this.lineId});  
            }));
        }
        
        return defd;
    },
    
    /*
     * Sets the selected route programmatically. If validate is false, it will not validate the provided values.
     * routeValues: {
     *     routeId: <string>
     *     routeName: <string>
     *     routeFeature: feature <esri/Graphic>
     *     lineId: <string or number>
     */
    setRouteValues: function(routeValues, validate) {
        routeValues = routeValues || {};
        this.set("store", new Memory());
        var routeValue = routeNameUtils.useRouteName(this.networkLayer) ? routeValues.routeName : routeValues.routeId;
        this.set("value", routeValue);
        this.routeId = routeValues.routeId;
        this.routeName = routeValues.routeName;
        this.routeFeature = routeValues.routeFeature;
        this.lineId = routeValues.lineId;
        if (validate) {
            this._onBlur();
        } else {
            this._validateLine(routeValue, routeValues.routeFeature);
        }
    },
    
    /*
     * returns defd with true/false that is resolved after route ID is validated
     */
    setRouteId: function(routeId) {
        this.set("store", new Memory());
        return this.validateRouteById(routeId);
    },
    
    /*
     * Returns the selected route's ID
     * Will return null if the selected route has not been validated.
     */
    getRouteId: function() {
        if (this.routeIsValidated) {
            return this.routeId;
        } else {
            return null;
        }
    },
    
    _setFromRouteFormAttr: function(val) {
        this.fromRouteForm = val;
        this.own(on(this.fromRouteForm, "routevalidated", lang.hitch(this, function() {
            if (this.routeFeature && this.fromRouteForm && this.networkLayer && this.networkLayer.supportsLines) {
                this._validateLine(this.get("value"), this.routeFeature);
            }
        })));    
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
    },
    
    _setNetworkLayerAttr: function(val) {
        if (val != this.networkLayer) {
            this.networkLayer = val;
            this.routeFieldName = routeNameUtils.getRouteFieldName(this.networkLayer);
            if (this._routeTask) {
                this._routeTask.setNetworkLayer(this.networkLayer);
            }
            this.populateOptions();
            this.validateRoute();
        }    
    },
    
    _setDropDownButtonState: function() {
        if (this._hasOptions()) {
            domStyle.set(this._buttonNode, "display", "block");
        } else {
            domStyle.set(this._buttonNode, "display", "none");
        }    
    },
    
    _setStoreAttr: function(val, key) {
        this.inherited(arguments);
        this._setDropDownButtonState();
        if (key == this.get("value")) {
            this._populatingOptions = false;
            this._startSearch(key);    
        }
    },
    
    populateOptions: function() {
        if (this._focused) {         
            this._populatingOptions = true;
            var networkLayer = this.networkLayer;
            var value = this.get("value");
            if (networkLayer) {            
                var field = utils.findField(this.networkLayer.fields, routeNameUtils.getRouteFieldName(networkLayer));
                if (value == null || value.length < this.minKeyCount || !this._routeTask) {
                    this.set("store", new Memory());
                } else {
                    this._routeTask.getRoutesByKey(value, field, this.maxRecordCount).then(lang.hitch(this, function(results) {
                        var data = array.map(results, function(routeValue) {
                            return ({name: routeValue + ""});
                        }, this);
                        this.set("store", new Memory({data: data}), value);
                    }), lang.hitch(this, function(err) {
                        console.log("Could not populate intellisense for route combo box.");
                        console.log(err);
                        this.set("store", new Memory());
                    }));
                }
            } else {
                this.set("store", new Memory());
            }
        } else {
            this.set("store", new Memory());
        }
    },
    
    // override search method to only show options after query is done
    _startSearch: function (/*String*/key) {
        if (!this._hasOptions()) {
            this.closeDropDown();
            return;
        }
        if (!this._populatingOptions) {
            this.inherited(arguments);
        }
    },
    
    _hasOptions: function() {
        return (this.store && this.store.data && this.store.data.length > 0);
    },
    
    /*
     * Overrides the function of ValidationTextBox to include check of whether
     * the route entered is valid.
     */
    validator: function(/*anything*/ value, /*dijit.form.ValidationTextBox.__Constraints*/ constraints) {
        return this.isValidRoute && this.inherited(arguments);
    },
    
    /*
     * Validates the route entered when user tabs away from route text box 
     * or when the text box is unfocused.
     */
    _onBlur: function() {
        var args = arguments;
        this.set("store", new Memory());
        this.validateRoute();
        this.inherited(args);
    },
    
    /*
     * Validates a route to see if it exists.
     */
    validateRoute: function() {
        var routeTask = this._routeTask;
        var routeValue = this.get("value");
        this._setRouteIsInvalidated();
        if (this.networkLayer && routeTask) {
            if (routeValue && routeValue.length > 0) {
                this._routeTask.getRouteByValue(routeValue, true).then(lang.hitch(this, function(response) { 
                    if (this.get("value") == routeValue) {                
                        if (response) {
                            this._validateLine(routeValue, response);
                        } else {
                            this._routeValidationFailed(routeValue);
                        }
                    }                     
                }), lang.hitch(this, function(err) {
                    utils.showMessage(this.nls.errorValidatingRoute);
                    console.log("Could not validate the route.");
                    console.log(err);
                    this._routeValidationFailed(routeValue);
                }));                       
            } else {
                this._routeValidationPassed(routeValue);
            }
        } else {
            this._routeValidationPassed(routeValue);
        }
    },
    
    _validateLine: function(routeValue, routeFeature) {
        if (routeFeature && this.fromRouteForm && this.networkLayer && this.networkLayer.supportsLines) {
            this.fromRouteForm.getRouteValues().then(lang.hitch(this, function(fromRouteValues) {
                if (fromRouteValues.routeId) {
                    var lineId = routeFeature.attributes[this.networkLayer.lineIdFieldName];
                    if (lineId == fromRouteValues.lineId) {
                        this._routeValidationPassed(routeValue, routeFeature);
                    } else {
                        this._routeValidationFailed(routeValue, this.nls.invalidRouteOnLine);
                    }
                } else {
                    this._routeValidationPassed(routeValue, routeFeature);
                }
            }));
        } else {
            this._routeValidationPassed(routeValue, routeFeature);
        }
    },
    
    _routeValidationPassed: function(routeValue, routeFeature) {
        this.set("isValidRoute", true);
        if (routeFeature) {            
            this.routeId = routeFeature.attributes[this.networkLayer.compositeRouteIdFieldName];
            this.routeFeature = routeFeature;
            this.lineId = routeFeature.attributes[this.networkLayer.lineIdFieldName];
            if (routeNameUtils.supportsRouteName(this.networkLayer)) {
                this.routeName = routeFeature.attributes[this.networkLayer.routeNameFieldName];
            } else {
                this.routeName = null;
            }
        }
        this._setRouteIsValidated(routeValue, routeFeature);
    },
    
    _routeValidationFailed: function(routeValue, invalidMessage) {
        if (!invalidMessage) {
            invalidMessage = routeNameUtils.useRouteName(this.networkLayer) ? this.nls.invalidRouteName : this.nls.invalidRouteId;
        }
        this.invalidMessage = invalidMessage;
        this.set("isValidRoute", false);
        this._setRouteIsValidated(routeValue, null);
    },
    
    /*
     * Validates a route by route ID to see if it exists.
     * returns defd with true/false that is resolved after route ID is validated
     */
    validateRouteById: function(routeId) {
        var defd = new Deferred();
        var routeTask = this._routeTask;
        this._setRouteIsInvalidated();
        if (this.networkLayer && routeTask) {
            this.invalidMessage = routeNameUtils.useRouteName(this.networkLayer) ? this.nls.invalidRouteName : this.nls.invalidRouteId;
            if (routeId && routeId.length > 0) {
                this._routeTask.getRouteById(routeId, true).then(lang.hitch(this, function(response) {                        
                    if (response) {
                        this.set("isValidRoute", true);
                        this.setRouteValues({
                            routeId: response.attributes[this.networkLayer.compositeRouteIdFieldName],
                            routeName: response.attributes[this.networkLayer.routeNameFieldName],
                            routeFeature: response,
                            lineId: response.attributes[this.networkLayer.lineIdFieldName]
                        }, false);
                        defd.resolve(true);
                    } else {
                        this.set("isValidRoute", false);
                        this.setRouteValues({}, false);
                        defd.resolve(false);
                    }                  
                }), lang.hitch(this, function(err) {
                    utils.showMessage(this.nls.errorValidatingRoute);
                    console.log("Could not validate the route by route ID.");
                    console.log(err);
                    this.set("isValidRoute", false);
                    this.setRouteValues({}, false);
                    defd.resolve(false);
                }));                       
            } else {
                this.set("isValidRoute", true);
                this.setRouteValues({}, false);
                defd.resolve(true);
            }
        } else {
            this.set("isValidRoute", true);
            this.setRouteValues({}, false);
            defd.resolve(true);
        }
        return defd;
    },
    
    _resetRouteValues: function() {
        this.routeId = null;
        this.routeFeature = null;
        this.routeName = null;
        this.lineId = null;
    },
    
    _setRouteIsInvalidated: function() {
        this._resetRouteValues();
        if (this.routeIsValidated) {            
            this.routeIsValidated = false;
            this.onRouteInvalidated();
        }
    },
    
    _setRouteIsValidated: function(routeValue, feature) {
        var currentValue = this.get("value");
        if (currentValue == routeValue || (utils.isEmptyString(currentValue) && utils.isEmptyString(routeValue))) {
            this.routeIsValidated = true;
            this.onRouteValidated(this.isValidRoute, feature);
        }    
    },
    
    _setIsValidRouteAttr: function(val) {
        this.isValidRoute = val;
        this.validate();  
    },

    /*
     * Resets the state of a route text box to remove invalid messages and 
     * text box highlight.
     */
    resetErrorState: function() {
        this.isValidRoute = true;
        var temp = this.required;
        this.required = false;
        this.validate();
        this.required = temp;
    }
});  // end declare
});  // end define
