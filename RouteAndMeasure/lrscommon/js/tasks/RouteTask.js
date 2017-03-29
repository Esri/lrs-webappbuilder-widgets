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
    "esri/tasks/QueryTask",
    "esri/tasks/query",
    "../util/geometry",
    "../util/routeName",
    "../util/utils",
], function(
    array, declare, lang, Deferred, QueryTask, Query, geometryUtils, routeNameUtils, utils
) {

return declare(null, {
    _mapManager: null,
    _networkLayer: null,
    _routeStartEndDate: null,
    _checkLinesSupport: false,
    
    constructor: function(params) {
        this._mapManager = params.mapManager;
        if (params.networkLayer) {
            this._networkLayer = params.networkLayer;
        } else if (params.eventLayer) {
            this._networkLayer = utils.findLayer(this._mapManager.lrsServiceConfig.networkLayers, params.eventLayer.parentNetwork.id);
        }
    },
    
    /*
     * Sets the active network layer.
     */
    setNetworkLayer: function(networkLayer) {
        this._networkLayer = networkLayer;
    },
    
    /*
     * Returns the selected network layer.
     */
    getQueryLayer: function() {
        return this.getNetworkLayer();
    },
    
    /*
     * Gets the active network layer.
     */
    getNetworkLayer: function() {
        return this._networkLayer;
    },
    
    /*
     * Returns featureSet of routes at a point on the map
     */ 
    getRoutesAtPoint: function(mapClickPoint, returnGeometry, generalizeGeometry) {
        var defd = new Deferred();
        
        if (!this._networkLayer) {
            console.log("No network layer selected to select a route.");
            defd.resolve();
        }
        
        // Buffer the point to intersect any nearby routes
        var map = this._mapManager.map,
            buffer = this._mapManager.tolerancePixels * (map.extent.getWidth() / map.width),
            bufferExtent = geometryUtils.pointToExtent(mapClickPoint, buffer);
        
        var query = new Query();
        query.geometry = bufferExtent;
        query.outFields = ["*"];
        if (returnGeometry) { 
            query.returnGeometry = true;
            query.outSpatialReference = map.spatialReference;
            query.returnM = true;
            if (generalizeGeometry) {                
                // Generalize the geometry since we only need a rough feature extent
                query.maxAllowableOffset = geometryUtils.maxAllowableOffset(5, this._mapManager.getMapUnits());
            }
        }
        
        var queryUrl = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + this._networkLayer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            defd.resolve(featureSet);
        }), lang.hitch(this, function(err) {
            console.log(this.declaredClass + '.getRoutesAtPoint(): err=' + err);
            defd.reject(err);
        }));
        
        return defd;
    },
    
    /*
     * Returns a Deferred with a feature found based on a route name or ID based on the network layer.
     */
    getRouteByValue: function(routeValue, returnGeometry, generalizeGeometry) {
        if (routeValue == null) {
            var defd = new Deferred();
            defd.resolve(null);
            return defd;
        }
        
        var whereClause = this.buildWhereClauseForRouteValue(routeValue);
        var errorMessage = "Unable to query route by value.";
        return this._getRoute(whereClause, returnGeometry, generalizeGeometry, errorMessage);
    },
    
    /*
     * Returns a Deferred with a feature found based on a route ID.
     */
    getRouteById: function(routeId, returnGeometry, generalizeGeometry) {
        if (routeId == null) {
            var defd = new Deferred();
            defd.resolve(null);
            return defd;
        }
        
        var whereClause = this.buildWhereClauseForCompositeRouteId(routeId);
        var errorMessage = "Unable to query route by ID.";
        return this._getRoute(whereClause, returnGeometry, generalizeGeometry, errorMessage);
    },
    
    /*
     * Returns a Deferred with a feature found based on a route name.
     */
    getRouteByName: function(routeName, returnGeometry, generalizeGeometry) {
        if (routeName == null) {
            var defd = new Deferred();
            defd.resolve(null);
            return defd;
        }
        
        var whereClause = this.buildWhereClauseForRouteName(routeName);
        var errorMessage = "Unable to query route by name.";
        return this._getRoute(whereClause, returnGeometry, generalizeGeometry, errorMessage);
    },
    
    /*
     * Gets a route based on a where clause
     */
    _getRoute: function(whereClause, returnGeometry, generalizeGeometry, errorMessage) {
        var defd = new Deferred(),
            layer = this.getQueryLayer();
        if (!layer) {
            defd.resolve(null);
            return defd;
        }
        
        var query = new Query();
        query.where = whereClause; 
        query.outFields = ["*"];
        if (returnGeometry) {            
            query.returnGeometry = true;
            query.outSpatialReference = this._mapManager.map.spatialReference;
            query.returnM = true;
            if (generalizeGeometry) {                
                // Generalize the geometry since we only need a rough feature extent
                query.maxAllowableOffset = geometryUtils.maxAllowableOffset(5, this._mapManager.getMapUnits());
            }
        } else {
            query.returnGeometry = false;
        } 
        
        var queryUrl = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + layer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            if (featureSet && featureSet.features && featureSet.features.length > 0) {
                defd.resolve(featureSet.features[0]);
            } else {
                defd.resolve(null);
            }
        }), lang.hitch(this, function(err) {
            errorMessage = errorMessage ? errorMessage : "Unable to query route.";
            console.log(errorMessage, err);
            defd.reject(err);
        }));
        
        return defd;
    },
    
    /*
     * Returns a list of routes that match the key.
     * keyField should be the field to search on (route id or route name)
     * limit is the max records to return (default is 10)
     */
    getRoutesByKey: function(key, keyField, limit) {
        var defd = new Deferred();
        
        // Validate the input fields
        if (!this._networkLayer) {
            console.log("No network layer to search for routes.");
            defd.resolve([]);
            return defd;
        } else if (!key) {
            console.log("No key to search for routes.");
            defd.resolve([]);
            return defd;
        } else if (!keyField) {
            console.log("No key field to search for routes.");
            defd.resolve([]);
            return defd;
        }
        
        key = (key != "" && utils.isDecimalType(keyField.type)) ? number.parse(key) : key;
        limit = limit ? limit : 10;
        var query = new Query();
        query.where = "UPPER(" + keyField.name + ") LIKE '" + utils.escapeSql(key).toUpperCase() + "%'";; 
        query.returnGeometry = false;
        query.outFields = [keyField.name];
        query.returnDistinctValues = true;
        query.orderByFields = [keyField.name];
        
        var queryUrl = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + this._networkLayer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            var matches = [];
            if (featureSet && featureSet.features) {
                array.every(featureSet.features, function(feature, i) {
                    if (feature && feature.attributes && feature.attributes[keyField.name]) {
                        matches.push(feature.attributes[keyField.name]);
                    }
                    return i < limit-1;
                }, this);
            }
            defd.resolve(matches);
        }), lang.hitch(this, function(err) {
            console.log("Could not get routes by key.");
            defd.reject(err);
        }));
        
        return defd;
    },
    
    /*
     * Builds a where clause based on a composite route ID or route name depending on the network.
     */
    buildWhereClauseForRouteValue: function(routeValue) {
        var fieldName = routeNameUtils.getRouteFieldName(this._networkLayer);
        return this._buildWhereClause(routeValue, fieldName);
    },
    
    /*
     * Builds a where clause based on a composite route ID.
     */
    buildWhereClauseForCompositeRouteId: function(routeId) {
        return this._networkLayer ? this._buildWhereClause(routeId, this._networkLayer.compositeRouteIdFieldName) : null;
    },
    
    /*
     * Builds a where clause based on a route name.
     */
    buildWhereClauseForRouteName: function(routeName) {
        return this._networkLayer ? this._buildWhereClause(routeName, this._networkLayer.routeNameFieldName) : null;
    },
    
    _buildWhereClause: function(searchValue, fieldName) {
        var networkLayer = this._networkLayer;
        if (networkLayer && fieldName) {
            var isStringField = utils.isStringField(networkLayer.fields, fieldName);
            return fieldName + "=" + utils.enquoteFieldValue(searchValue, isStringField);
        } else {
            return null;
        }
    },
    
    /*
     * Returns Deferred with object {
     *     valid: <bool>
     *     geometry: <esri geometry object>
     * }.
     */
    isMeasureOnRoute: function(routeId, measure) {
        var defd = new Deferred();
        var networkLayer = this._networkLayer;
        
        if ((!networkLayer) || (!routeId || routeId.length === 0) || !utils.isValidNumber(measure)) {
            defd.resolve({ valid: false });
            return defd;
        }
        
        var params = {
            locations: this.getLocations(routeId, measure),
            outSR: this._mapManager.map.spatialReference.toJson()
        };
        var task = this._mapManager.lrsServiceTask;
        
        task.measureToGeometry(networkLayer.id, params).then(
            lang.hitch(this, function(response) {
                var loc = response.locations[0],
                    status = loc.status;
                if (status === "esriLocatingOK") {
                    defd.resolve({
                        valid: true,
                        geometry: geometryUtils.create(loc)
                    });
                } else {
                    defd.resolve({ valid: false });
                }
            }),
            lang.hitch(this, function(err) {
                console.log('Error converting measure to geometry.', err);
                defd.reject(err);
            })
        );            

        return defd;
    },
    
    getRoutesOnLine: function(lineId, fromLineOrder, toLineOrder, returnGeometry, generalizeGeometry) {
        var defd = new Deferred();
        
        // Validate the input fields
        if (!this._networkLayer) {
            console.log("No network layer to search for routes on line.");
            defd.resolve([]);
            return defd;
        } else if (!lineId) {
            console.log("No line ID to search for routes on line.");
            defd.resolve([]);
            return defd;
        } else if (!this._networkLayer.supportsLines) {
            console.log("Network layer does not support lines. Cannot search for routes on line.");
            defd.resolve([]);
            return defd;
        }
        
        var query = new Query();
        var lineOrderFieldName = this._networkLayer.lineOrderFieldName;
        query.where = this._buildWhereClause(lineId, this._networkLayer.lineIdFieldName); 
        if (utils.isValidNumber(fromLineOrder) && utils.isValidNumber(toLineOrder)) {
            if (fromLineOrder > toLineOrder) {
                var temp = fromLineOrder;
                fromLineOrder = toLineOrder;
                toLineOrder = temp;
            }
            var lineOrderWhere = lineOrderFieldName + ">=" + fromLineOrder + " AND " + lineOrderFieldName + "<=" + toLineOrder;
            query.where = utils.concatenateWhereClauses(query.where, lineOrderWhere);
        }
        query.outFields = ["*"];
        if (returnGeometry) {            
            query.returnGeometry = true;
            query.outSpatialReference = this._mapManager.map.spatialReference;
            query.returnM = true;
            if (generalizeGeometry) {                
                // Generalize the geometry since we only need a rough feature extent
                query.maxAllowableOffset = geometryUtils.maxAllowableOffset(5, this._mapManager.getMapUnits());
            }
        } else {
            query.returnGeometry = false;
        } 
        
        var queryUrl = utils.appendUrlPath(this._mapManager.lrsMapLayerConfig.url, "/" + this._networkLayer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            if (featureSet && featureSet.features) {
                defd.resolve(featureSet.features);
            } else {
                defd.resolve([]);
            }
        }), lang.hitch(this, function(err) {
            console.log("Unable to query routes on line.", err);
            defd.reject(err);
        }));
        
        return defd;
    },
    
    getLocations: function(routeId, fromMeasure, toMeasure, toRouteId) {
        var validFromMeasure = utils.isValidNumber(fromMeasure);
        var validToMeasure = utils.isValidNumber(toMeasure);
        var location = { routeId: routeId };
        if (toRouteId && toRouteId.length > 0) {
            location["toRouteId"] = toRouteId;
        }
        
        if (validFromMeasure && validToMeasure) {
            location.fromMeasure = fromMeasure;
            location.toMeasure = toMeasure;
        } else if (validFromMeasure) {
            location.measure = fromMeasure;
        } else if (validToMeasure) {
            location.measure = toMeasure;
        }
        
        return [location];
    }
});  // end declare
});  // end define
