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
    "dojo/_base/lang",
    "dojo/Deferred",
    "esri/request",
    "jimu/LayerInfos/LayerInfos",
    "../util/utils"
], function(
    array, lang, Deferred, esriRequest, LayerInfos, utils
) {
    /*
     * A module for fetching and caching service and layer info from RESTful map services. 
     * This allows many application widgets and modules to obtain service and layer metadata 
     * while minimizing network communication costs.
     */
    
    var _cache = {}; // mapping URL to content
    var _appBuilderCache = {}; // mapping URL to jimu/LayerInfos/LayerInfo
    
    /*
     * Returns a Deferred that resolves to the JSON content from a URL.
     */
    function get(/*String*/ url) {
        var defd = new Deferred();
        var key = utils.removeUrlQuery(url);
        
        if (key in _cache) {
            defd.resolve(_cache[key]);
        } else {
            esriRequest({
                url: url,
                content: { f: "json" },
                callbackParamName: "callback"
            }).then(function(content) {
                content = content || {};
                _cache[key] = content;
                defd.resolve(content);
            }, function(err) {
                console.log("error: "+err.toString());
                defd.reject(err);
            });
        }
        
        return defd;
    }
    
    /*
     * Returns a Deferred that resolves to the jimu/LayerInfos/LayerInfo object from Web AppBuilder.
     */
    function getAppBuilderLayerObject(/*String*/ url, lrsMapLayerId) {
        var defd = new Deferred();
        var key = utils.removeUrlQuery(url);
        
        if (key in _appBuilderCache) {
            defd.resolve(_appBuilderCache[key]);
        } else {            
            var layerInfosObject = LayerInfos.getInstanceSync();
            var layerInfo = null;
            if (layerInfosObject) {                
                var lrsLayerInfo = layerInfosObject.getLayerInfoById(lrsMapLayerId);
                if (lrsLayerInfo) {                    
                    lrsLayerInfo.traversal(lang.hitch(this, function(candLayerInfo) {
                        if ((!layerInfo) && candLayerInfo.layerObject && candLayerInfo.layerObject.url == key) {
                            layerInfo = candLayerInfo;
                        }
                    }));
                }
            }
            if (layerInfo) {
                layerInfo.getLayerObject().then(lang.hitch(this, function(layerObject) {
                    layerObject = layerObject || {};
                    _appBuilderCache[key] = layerObject;
                    defd.resolve(layerObject);
                }), lang.hitch(this, function(err) {
                    defd.reject(err);
                }));
            } else {
                defd.reject({message: "Could not locate the layer in lrs map service LayerInfos."});
            }
        }
            
        return defd;
    }
    
    // Module exports
    return {
        get: get,
        getAppBuilderLayerObject: getAppBuilderLayerObject
    };
});  // end define
