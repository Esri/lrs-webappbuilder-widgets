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
    "dojo/_base/json",
    "dojo/_base/lang",
    "esri/request",
    "esri/urlUtils"
], function(
    array, declare, json, lang, esriRequest, urlUtils
) {
/*
 * A wrapper around the LRS service REST API.
 */
return declare(null, {
    
    url: null,
    gdbVersion: null,
    disableClientCaching: true,
    
    constructor: function(url, options) {
        this.url = url;
        if (options) {
            if (options.disableClientCaching !== undefined) {
                this.disableClientCaching = !!options.disableClientCaching;
            }
            if (options.gdbVersion != null) {
                this.gdbVersion = options.gdbVersion;
            }
        }
    },
    
    /*
     * Sets the GDB version to use for LRS operations.
     */
    setGDBVersion: function(version) {
        this.gdbVersion = version;
    },
    
    /// REST Resources ///
    
    /*
     * Retrieves basic metadata for the LRS service.
     */
    getServiceInfo: function(callback, errback) {
        return this._request("", null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for all LRS layers.
     */
    getAllLayersInfo: function(callback, errback) {
        return this._request("/layers", null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single network layer.
     */
    getNetworkLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/networkLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single event layer.
     */
    getEventLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/eventLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single redline layer.
     */
    getRedlineLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/redlineLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single centerline layer.
     */
    getCenterlineLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/centerlineLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single calibration point layer.
     */
    getCalibrationPointLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/calibrationPointLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves detailed metadata for a single intersection layer.
     */
    getIntersectionLayerInfo: function(/*int*/ layerId, callback, errback) {
        return this._request("/intersectionLayers/"+layerId, null, null, callback, errback);
    },
    
    /*
     * Retrieves information on the LRS route locking scheme for all LRS workspaces in the map service.
     */    
    getLocks: function(callback, errback) {
        return this._request("/locks", null, null, callback, errback);
    },
    
    /// REST Operations ///
    
    applyEdits: function(params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._request("/applyEdits", params, { usePost: true }, callback, errback);
    },
    
    reconcileVersion: function(params, callback, errback) {
        return this._request("/reconcileVersion", params, null, callback, errback);
    },
    
    createVersion: function(params, callback, errback) {
        return this._request("/createVersion", params, null, callback, errback);    
    },
    
    deleteVersion: function(params, callback, errback) {
        return this._request("/deleteVersion", params, null, callback, errback);
    },
    
    geometryToMeasure: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/networkLayers/"+networkLayerId+"/geometryToMeasure", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.locations, function(loc) {
                    array.forEach(loc.results, function(result) {
                        if (result.geometry) {
                            result.geometry.spatialReference = response.spatialReference;
                        }
                    }, this);
                }, this);
                return response;
            })
        );
    },
    
    measureToGeometry: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/networkLayers/"+networkLayerId+"/measureToGeometry", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.locations, function(loc) {
                    if (loc.geometry) {
                        loc.geometry.spatialReference = response.spatialReference;
                    }
                }, this);
                return response;
            })
        );
    },
    
    geometryToStation: function(/*int*/ eventLayerId, params, callback, errback) {
    	params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/eventLayers/"+eventLayerId+"/geometryToStation", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.locations, function(loc) {
                    array.forEach(loc.results, function(result) {
                        if (result.geometry) {
                            result.geometry.spatialReference = response.spatialReference;
                        }
                    }, this);
                }, this);
                return response;
            })
        );
    },
    
    stationToGeometry: function(/*int*/ eventLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/eventLayers/"+eventLayerId+"/stationToGeometry", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.locations, function(loc) {
                	array.forEach(loc.geometries, function(geom) {
                		geom.spatialReference = response.spatialReference;
                	});
                }, this);
                return response;
            })
        );
    },
    
    translate: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._request("/networkLayers/"+networkLayerId+"/translate", params, null, callback, errback);
    },
    
    checkEvents: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/networkLayers/"+networkLayerId+"/checkEvents", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.results, function(result) {
                    if (result.geometry) {
                        result.geometry.spatialReference = response.spatialReference;
                    }
                }, this);
                return response;
            })
        );
    },
    
    queryAttributeSet: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);
        return this._requestWithFilter("/networkLayers/"+networkLayerId+"/queryAttributeSet", params, null, callback, errback, 
            lang.hitch(this, function(response) {
                // Apply the response-level spatial reference to each nested geometry
                array.forEach(response.features, function(feature) {
                    if (feature.geometry) {
                        feature.geometry.spatialReference = response.spatialReference;
                    }
                }, this);
                return response;
            })
        );
    },
    
    /*
     * Returns the concurrent sections. Makes sure from measures are less than to measures even if
     * the concurrent routes are calibrated in opposite directions.
     */
    concurrencies: function(/*int*/ networkLayerId, params, callback, errback) {
        params = this._mixinGDBVersion(params);  
        return this._requestWithFilter("/networkLayers/"+networkLayerId+"/concurrencies", params, null, callback, errback,
            lang.hitch(this, function(response) {
                var checkMeasures = function(measures) {
                    if (measures.fromMeasure > measures.toMeasure) {
                        var temp = measures.fromMeasure;
                        measures.fromMeasure = measures.toMeasure;
                        measures.toMeasure = temp;
                    }
                };
                array.forEach(response.locations, function(location) {
                    checkMeasures(location);
                    array.forEach(location.concurrencies, function(concurrency) {
                        checkMeasures(concurrency);
                    }, this);
                }, this);
                return response;
            })
        );
    },
    
    /*
     * Queries the LRS locks table and returns a list of lock records that match the where clause.
     */
    queryLocks: function(params, callback, errback) {
        return this._request("/locks/query", params, null, callback, errback);
    },
    
    /*
     * Acquires a set of LRS locks to enable the invoking user to perform edits on event layers.
     */
    acquireLocks: function(params, callback, errback) {
        return this._request("/locks/acquire", params, null, callback, errback);
    },
    
    /*
     * Releases a set of LRS locks that are currently held by the invoking user.
     */
    releaseLocks: function(params, callback, errback) {
        return this._request("/locks/release", params, null, callback, errback);
    },
            
    /// Private methods ///
    
    _mixinGDBVersion: function(params) {
        if (this.gdbVersion != null) {
            params = lang.mixin({ gdbVersion: this.gdbVersion }, params || {});
        }
        return params;
    },
    
    _request: function(urlSuffix, params, options, callback, errback) {
        var urlObj = urlUtils.urlToObject(this.url);
        urlObj.path += (urlSuffix || "");
        urlObj.query = urlObj.query || {};
        if (params) {
            var name, val;
            for (name in params) {
                val = params[name];
                // Avoid quoting of simple string values
                if (!lang.isString(val)) {
                    val = json.toJson(val);
                }
                urlObj.query[name] = val;
            }
        }
        urlObj.query.f = "json";
        
        return esriRequest({
            url: urlObj.path,
            content: urlObj.query,
            callbackParamName: "callback",
            preventCache: this.disableClientCaching,
            load: callback,
            error: errback
        }, options);
    },
    
    _requestWithFilter: function(urlSuffix, params, options, callback, errback, filterFunc) {
        // Don't pass in the callback to _request().
        // Instead register it *after* the response filter has a chance to run.
        var defd = this._request(urlSuffix, params, options, null, errback);
        if (filterFunc) {
            defd = defd.then(function(response) {
                return filterFunc(response) || response;
            });
        }
        if (callback) {
            defd.then(callback);
        }
        return defd;
    }
});  // end declare
});  // end define
