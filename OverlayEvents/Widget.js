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
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/string",
    "dijit/form/CheckBox",
    "dijit/form/Select",
    "jimu/LayerStructure",
    "jimu/SelectionManager",
    "esri/Color",
    "esri/graphicsUtils",
    "esri/layers/FeatureLayer",
    "esri/renderers/SimpleRenderer",
    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/tasks/FeatureSet",
    "./lrscommon/js/form/MeasurePicker",
    "./lrscommon/js/form/RoutePicker",
    "./lrscommon/js/LrsWidget",
    "./lrscommon/js/tasks/serviceInfoCache",
    "./lrscommon/js/util/domain",
    "./lrscommon/js/util/geometry",
    "./lrscommon/js/util/i18n",
    "./lrscommon/js/util/routeName",
    "./lrscommon/js/util/utils"
], function(
    array, declare, lang, Deferred, DeferredList, domAttr, domConstruct, domStyle, string, CheckBox, Select, LayerStructure, SelectionManager, 
    Color, graphicsUtils, FeatureLayer, SimpleRenderer, PictureMarkerSymbol, SimpleLineSymbol, SimpleMarkerSymbol, FeatureSet, 
    MeasurePicker, RoutePicker, LrsWidget, serviceInfoCache, domainUtils, geometryUtils, i18nUtils, routeNameUtils, utils
) {
    return declare([LrsWidget], {

        baseClass: 'jimu-widget-lrswidget',
        _networkLayer: null,
        _eventLayerCheckboxes: null,
        _layerStructure: null,
        _overlayLayerNodeId: null,
        
        _onLrsLoaded: function() {
            this._layerStructure = LayerStructure.getInstance();
            this._setRouteInputConfig();
            this._setMeasureInputConfig();
            this._populateNetworkSelect();
            this._populateEventLayers();
            this.showContent();
        },
        
        _setRouteInputConfig: function() {
            array.forEach([this._fromRouteInput, this._toRouteInput], function(routeInput) {
                routeInput.selectOnGraphicsLayer = true;
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
            var layerId = this._networkLayer ? this._networkLayer.id : null;
            this._mapManager.makeLrsLayerVisible(layerId);
        },
        
        /*
         * Creates the event layer checkboxes
         */
        _populateEventLayers: function() {
            var eventsDiv = "_eventsDiv";
            var linearEvents = array.filter(this._mapManager.lrsServiceConfig.eventLayers, function(eventLayer) {
                return eventLayer.type == "esriLRSLinearEventLayer";
            }, this);
            var half = linearEvents.length/2;
            this._eventLayerCheckboxes = array.map(linearEvents, function(eventLayer, i) {
                var parent = eventsDiv + (i < half ? "1":"2");
                parent = eventsDiv + "1";
                var label = domConstruct.create("label", {innerHTML: eventLayer.name, style: {display: "block"}}, this[parent]);
                var check = new CheckBox({
                    value: eventLayer.id,
                    checked: false
                });
                domConstruct.place(check.domNode, label, "first");
                return check;
            }, this);
        },
        
        _pan: function() {
            this._panOrZoom("pan");
        },
        
        _zoom: function() {
            this._panOrZoom("zoom");
        },
        
        /*
         * Pans or zooms to the selected route and measures
         */
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
        
        /*
         * Gets the routes and measures from the inputs
         */
        _getRoutesAndMeasures: function() {
            var defd = new Deferred();
            
            var defds = [
                this._fromMeasureInput.getMeasure(),
                this._toMeasureInput.getMeasure(),
                this._fromRouteInput.getRouteValues()
            ];
            if (this._networkLayer && this._networkLayer.supportsLines) {
                defds.push(this._toRouteInput.getRouteValues());
            }
            
            new DeferredList(defds).then(lang.hitch(this, function(responses) {
                var fromMeasureValues = responses[0][1];
                var toMeasureValues = responses[1][1];
                var fromRouteValues = responses[2][1];
                var toRouteValues = responses.length > 3 ? responses[3][1] : null;
                defd.resolve({fromMeasureValues: fromMeasureValues, toMeasureValues: toMeasureValues, fromRouteValues: fromRouteValues, toRouteValues: toRouteValues});
            }));
            
            return defd;
        },
        
        /*
         * Makes sure the routes are valid and if lines are supported that the from and to route are on the same line
         */
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
        
        /*
         * Make sure the measures are valid numbers
         */
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
        
        /*
         * Makes sure if to inputs are provided that from inputs were also provided
         */
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
        
        /*
         * Gets a partial route geometry based on measures
         */
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
        
        _selectAllEvents: function() {
            array.forEach(this._eventLayerCheckboxes, function(eventCheck) {
                eventCheck.set("checked", true);
            }, this);
        },
        
        _clearAllEvents: function() {
            array.forEach(this._eventLayerCheckboxes, function(eventCheck) {
                eventCheck.set("checked", false);
            }, this);
        },
        
        /*
         * Overlay the selected events
         */
        _overlay: function() {
            var eventLayers = this._getSelectedEventLayers();
            if (eventLayers == null || eventLayers.length < 1) {
                this.showMessage(this.nls.noEventsSelected);
                return;
            }
            this.showBusy();
            this._getRoutesAndMeasures().then(lang.hitch(this, function(routesAndMeasures) {
                var fromRouteValues = routesAndMeasures.fromRouteValues;
                var toRouteValues = routesAndMeasures.toRouteValues;
                var fromMeasureValues = routesAndMeasures.fromMeasureValues;
                var toMeasureValues = routesAndMeasures.toMeasureValues;
                if (this._areRoutesValid(fromRouteValues, toRouteValues) && 
                    this._areMeasuresValid(fromMeasureValues, toMeasureValues) && 
                    this._areToInputsValid(toRouteValues, toMeasureValues, fromMeasureValues)
                ) {
                    var fromRouteId = fromRouteValues.routeId;
                    var toRouteId = toRouteValues ? toRouteValues.routeId : null;
                    var fromMeasure = fromMeasureValues.measure;
                    var toMeasure = toMeasureValues.measure;
                    var location = this._getLocation(fromRouteId, toRouteId, fromMeasure, toMeasure);
                    var attributeSet = this._getAttributeSet(eventLayers);
                    var params = {
                        locations: [location],
                        attributeSet: attributeSet,
                        outSR: this._mapManager.map.spatialReference.toJson()
                    };
                    // do the event overlay
                    this._mapManager.lrsServiceTask.queryAttributeSet(this._networkLayer.id, params).then(lang.hitch(this, function(response) {
                        this.hideBusy();
                        // remove object ID fields before mapping the new field names to old field names so that the object ID fields do not mess up the count
                        this._fixObjectId(response);
                        // map new field names to old field names and event layers
                        var newFieldNameToOldInfo = this._createNewFieldNameToOldInfo(response.geometryType, response.fields, attributeSet);
                        var layerIdToOldToNewFieldNames = this._createLayerIdToOldToNewFieldNames(response.geometryType, response.fields, attributeSet);
                        // make the data pretty
                        this._applyMeasurePrecision(response);
                        this._applyDomains(response, newFieldNameToOldInfo, layerIdToOldToNewFieldNames);
                        this._updateFieldAlias(response, newFieldNameToOldInfo);
                        // add a new feature layer to the map
                        this._addOverlayToMap(response);
                    }), lang.hitch(this, function(err) {
                        this.hideBusy();
                        console.log("query attribute set error");
                        console.log(err);
                        var errorDetail = err ? err.message : "";
                        if (!errorDetail) {
                            errorDetail = "";
                        }
                        if (err.details && err.details.length > 0) {
                            errorDetail += "\n" + err.details.join("\n");
                        }
                        this.showErrorMessage(this.nls.queryAttributeSetError, errorDetail);
                    }));
                } else {
                    this.hideBusy();
                }
            }));
        },
        
        /*
         * Round the from and to measure fields to the measure precision in config or of the network
         */
        _applyMeasurePrecision: function(featureSet) {
            var networkLayer = this._networkLayer;
            if (networkLayer && featureSet && featureSet.features) {
                var measurePrecision = utils.isValidNumber(this._mapManager.measurePrecision) ? this._mapManager.measurePrecision : networkLayer.measurePrecision;
                var fields = featureSet.geometryType == "esriGeometryPoint" ? ["measure"] : ["to_measure", "from_measure"];
                array.forEach(featureSet.features, function(feature) {
                    array.forEach(fields, function(field) {
                        feature.attributes[field] = parseFloat(i18nUtils.formatNumber(feature.attributes[field], measurePrecision));
                    }, this);
                }, this);
            }
        },
        
        /*
         * Apply domain and subtype values
         */
        _applyDomains: function(featureSet, newFieldNameToOldInfo, layerIdToOldToNewFieldNames) {
            array.forEach(featureSet.features, function(feature) {
                var originalValues = lang.clone(feature.attributes);
                for (newField in feature.attributes) {
                    var oldInfo = newFieldNameToOldInfo[newField];
                    if (oldInfo) {
                        var attributes = null;
                        if (oldInfo.eventLayer.subtypeFieldName) {
                            attributes = {};
                            attributes[oldInfo.eventLayer.subtypeFieldName] = originalValues[layerIdToOldToNewFieldNames[oldInfo.eventLayer.id][oldInfo.eventLayer.subtypeFieldName]];
                        }
                        var codedValues = domainUtils.getCodedValues(oldInfo.field, oldInfo.eventLayer, attributes);
                        if (codedValues) {
                            var code = feature.attributes[newField];
                            var name = domainUtils.findName(codedValues, code);
                            if (name != null && name != code) {
                                feature.attributes[newField] = string.substitute(this.nls.domainCodeValue, [code, name]);
                            } 
                        }
                    }
                };
            }, this);
        },
        
        /*
         * Add the event layer name to field aliases
         */
        _updateFieldAlias: function(featureSet, newFieldNameToOldInfo) {
            array.forEach(featureSet.fields, function(field) {
                if (field.type != "esriFieldTypeOID") {
                    var oldInfo = newFieldNameToOldInfo[field.name];
                    if (oldInfo) {
                        field.alias = string.substitute(this.nls.overlayFieldAlias, [oldInfo.eventLayer.name, field.alias]);
                        featureSet.fieldAliases[field.name] = field.alias;
                    }
                }
            }, this);
        },
        
        /*
         * Creates and returns the mapping of new field name to an object with eventLayer and field.
         * The new field name is the duplicate field name that got renamed by the REST operation queryAttributeSet.
         */   
        _createNewFieldNameToOldInfo: function(geometryType, resultFields, attributeSet) {
            var eventLayers = this._mapManager.lrsServiceConfig.eventLayers;
            var fieldIndex = this._getAttributeSetFieldStartIndex(geometryType);
            var newFieldNameToOldInfo = {};
            
            if (resultFields && resultFields.length > fieldIndex) {
                // We assume that result fields will be in the same order as the input attribute set.
                array.forEach(attributeSet, function(set) {
                    var eventLayerInfo = utils.findLayer(set.layerId, eventLayers);
                    array.forEach(set.fields, function(fieldName) {
                        newFieldNameToOldInfo[resultFields[fieldIndex].name] = {
                            eventLayer: eventLayerInfo,
                            field: utils.findField(eventLayerInfo.fields, fieldName)
                        };
                        fieldIndex++;
                    }, this);
                }, this);
            }
            return newFieldNameToOldInfo;
        },
        
        /*
         * Creates and returns the mapping of old field name to new field name for 
         * each layer in the attribute set
         */
        _createLayerIdToOldToNewFieldNames: function(geometryType, resultFields, attributeSet) {
            var fieldIndex = this._getAttributeSetFieldStartIndex(geometryType);
            var layerIdToOldToNewFieldNames = {};
            
            if (resultFields && resultFields.length > fieldIndex) {
                // We assume that result fields will be in the same order as the input attribute set.    
                array.forEach(attributeSet, function(layerAttrSet) {
                    var oldToNewFieldNames = {};
                    array.forEach(layerAttrSet.fields, function(fieldName) {
                        oldToNewFieldNames[fieldName] = resultFields[fieldIndex].name;
                        fieldIndex++;
                    }, this);
                    layerIdToOldToNewFieldNames[layerAttrSet.layerId] = oldToNewFieldNames;
                }, this);
            }
            return layerIdToOldToNewFieldNames;
        },
        
        /*
         * Returns start index of attribute set field in the query attribute set results.
         * Skips the first two fields route_id and measure if result geometry type is Point.
         * Skips the first three fields route_id, from_measure, and to_measure if result geometry type is Polyline.
         * Skips the route name field if the network has route name
         * Skips line ID, line name, and line order fields if the network supports lines 
         */
        _getAttributeSetFieldStartIndex: function(geometryType) {
            var networkLayer = this._networkLayer;
            var numFieldsToSkip = geometryType === "esriGeometryPoint" ? 2 : 3; //route id and measure fields
            if (networkLayer) {
                if (networkLayer.routeNameFieldName != null && networkLayer.routeNameFieldName != "") {
                    numFieldsToSkip += 1; // route name
                }
                if (networkLayer.supportsLines) {
                    numFieldsToSkip += 3;  // line ID, line name, line order
                }
            }
            return numFieldsToSkip;
        },
        
        // FeatureLayer needs just one unique object ID field.
        // Since overlay events results have object IDs from multiple events and because of splitting
        // they will not be unique, remove all of those fields and add one unique object ID field.
        _fixObjectId: function(featureSet) {
            // get list of current object ID fields and remove them from the featureSet fields
            var objectIdFields = [];        
            featureSet.fields = array.filter(featureSet.fields, function(field) {
                if (field.type == "esriFieldTypeOID") {
                    delete featureSet.fieldAliases[field.name];
                    objectIdFields.push(field.name);
                    return false;
                }
                return true;
            }, this);
            
            // get a unique name for the new object ID field
            var objectIdFieldName = utils.getUniqueFieldName("OBJECTID", null, featureSet.fields);
            
            // add the new object ID field to the featureSet fields
            featureSet.fields.push({
                "name": objectIdFieldName,
                "type": "esriFieldTypeOID",
                "alias": this.nls.objectIdFieldAlias
            });
            featureSet.fieldAliases[objectIdFieldName] = this.nls.objectIdFieldAlias;
            
            // remove the old object IDs from the feature attributes and add the new one
            array.forEach(featureSet.features, function(feature, i) {
                array.forEach(objectIdFields, function(objectIdField) {
                    delete feature.attributes[objectIdField.name];
                }, this);
                feature.attributes[objectIdFieldName] = i;
            }, this);
        },
        
        /*
         * Add the overlay result as a new feature layer to the map. Add it as a feature layer
         * instead of a graphics layer so that the web appbuilder attribute table can use it.
         */
        _addOverlayToMap: function(featureSet) {
            featureSet = new FeatureSet(featureSet);
            var layer = new FeatureLayer({
                featureSet: featureSet,
                layerDefinition: {
                    "geometryType": featureSet.geometryType,
                    "fields": featureSet.fields
                }
            });
            var renderer = new SimpleRenderer(this._getOverlaySymbol(featureSet.geometryType));
            layer.setRenderer(renderer);
            layer.name = "Overlay";
            if (this._overlayLayerNodeId != null) {  
                // remove old overlay from the map              
                var oldLayer = this.map.getLayer(this._overlayLayerNodeId);
                if (oldLayer) {
                    oldLayer.clearSelection();
                    this.map.removeLayer(oldLayer);
                }
            }
            this._overlayLayerNodeId = null;
            this.map.addLayer(layer);
            this._overlayLayerNodeId = layer.id;
            this._sendLayerToAttributeTable();
        },
        
        _sendLayerToAttributeTable: function() {
            if (this._overlayLayerNodeId != null) {
                var layerInfo = this._layerStructure.getNodeById(this._overlayLayerNodeId);
                if (layerInfo) {
                    this.publishData({
                        "target": "AttributeTable",
                        "layer": layerInfo
                    });
                }
            }
        },
        
        _getOverlaySymbol: function(geometryType) {
            if (geometryType == "esriGeometryPoint") {
                return this._getOverlayPointSymbol(this.config);
            } else {    
                return this._getOverlayLineSymbol(this.config);           
            }
        },
        
        _getOverlayLineSymbol: function(config) {
            if (config.overlayLineSymbol) {
                return new SimpleLineSymbol(config.overlayLineSymbol);
            } else {
                return this._getDefaultLineSymbol();
            }    
        },
        
        _getDefaultLineSymbol: function() {
            return new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_SOLID, 
                new Color([255, 174, 0]), 
                4.0
            );
        },
        
        _getOverlayPointSymbol: function(config) {
            if (config.overlayPointSymbol) {
                if (config.overlayPointSymbol.type == "esriSMS") {
                    return new SimpleMarkerSymbol(config.overlayPointSymbol);
                } else {
                    return new PictureMarkerSymbol(config.overlayPointSymbol);
                }
            } else {
                return this._getDefaultPointSymbol();
            }
        },
        
        _getDefaultPointSymbol: function() {
            return new SimpleMarkerSymbol(
                SimpleMarkerSymbol.STYLE_DIAMOND, 
                12.0,
                new SimpleLineSymbol (SimpleLineSymbol.STYLE_SOLID, new Color([255, 174, 0]), 2.0),
                new Color([255, 211, 128])
            ); 
        },
        
        /*
         * Returns the location parameter for query attribute set
         */
        _getLocation: function(fromRouteId, toRouteId, fromMeasure, toMeasure) {
            var location = {
                'routeId': fromRouteId
            };
            if (utils.isValidNumber(fromMeasure) && utils.isValidNumber(toMeasure)) {
                location.fromMeasure = fromMeasure;
                location.toMeasure = toMeasure;
                if (toRouteId) {
                    location.toRouteId = toRouteId;
                }
            } else if (utils.isValidNumber(fromMeasure)) {
                location.measure = fromMeasure;
            } else if (utils.isValidNumber(toMeasure)) {
                location.measure = toMeasure;
            }
            return location;
        },
        
        /*
         * Returns the attribute set to use for query attribute set
         */
        _getAttributeSet: function(eventLayers) {
            var attributeSet = [];
            array.forEach(eventLayers, function(lrsEvent) {
                var exclude = utils.getLrsFields(lrsEvent);
                var objectIdField = utils.getObjectIdField(lrsEvent.fields);
                if (objectIdField) {
                    exclude.push(objectIdField.name.toLowerCase());
                }
                exclude = exclude.concat(["shape", "shape.len", "shape_len", "shape_length", "st_length(shape)", "shape.stlength()", "shape_area", "shape.starea()"]);
                var fields = [];
                array.forEach(lrsEvent.fields, function(field) {
                    if (array.indexOf(exclude, field.name.toLowerCase()) == -1) {
                        fields.push(field.name);
                    }
                }, this);
                attributeSet.push({
                    layerId: lrsEvent.id,
                    fields: fields
                });
            }, this);
            return attributeSet;
        },
        
        _getSelectedEventLayers: function() {
            var layers = [];
            array.forEach(this._eventLayerCheckboxes, function(eventCheck) {
                if (eventCheck.get("checked")) {
                    var layer = null;
                    array.some(this._mapManager.lrsServiceConfig.eventLayers, function(eventLayer) {
                        if (eventLayer.id == eventCheck.value) {
                            layer = eventLayer;
                            return true;
                        }
                        return false;
                    }, this);
                    if (layer) {
                        layers.push(layer);
                    }
                }
            }, this);
            return layers; 
        },
        
        onClose: function() {
            this._fromMeasureInput.setMeasure(null, null, false);
            this._toMeasureInput.setMeasure(null, null, false);
            this._toRouteInput.setRouteValues({}, false);
            this._fromRouteInput.setRouteValues({}, false);
            this._fromMeasureInput.deactivate();
            this._toMeasureInput.deactivate();
            this._toRouteInput.deactivate();
            this._fromRouteInput.deactivate();
        }
        
    });
});