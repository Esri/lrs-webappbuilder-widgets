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
    "dojo/_base/Deferred",
    "dojo/_base/lang",
    "dojo/DeferredList",
    "esri/tasks/QueryTask",
    "esri/tasks/query",
    "./sql",
    "./utils",
    "dojo/i18n!../nls/strings"
], function(
    array, Deferred, lang, DeferredList, QueryTask, Query, sqlUtils, utils, nls
) {
/*
 * General utility functions for using route name vs route id.
 */
var routeNameUtils = {
    
    /*
     * If layer is a network layer, checks for routeNameFieldName
     * If layer is an event layer that can span routes, checks for routeNameFieldName and toRouteNameFieldName
     * If layer is an event layer that cannot span routes, checks for routeNameFieldName
     */
    supportsRouteName: function(layer) {
        var supportsRouteName = layer && layer.routeNameFieldName != null && layer.routeNameFieldName != "";
        if (supportsRouteName && layer.canSpanRoutes) {
            supportsRouteName = layer.toRouteNameFieldName != null && layer.toRouteNameFieldName != "";
        }
        return supportsRouteName;
    },
    
    /*
     * Returns a Deferred with route name based on the route ID.
     */
    getRouteNameByRouteId: function(networkLayer, routeId, mapManager) {
        var defd = new Deferred();
        if (!networkLayer) {
            console.log("Route name utils: getRouteNameByRouteId: No network layer selected to get a route name based on the route ID.");
            defd.resolve(null);
            return defd;
        }
        
        // Validate the input fields
        if (!routeId) {
            console.log("Route name utils: getRouteNameByRouteId: No route given.");
            defd.resolve(null);
            return defd;
        }
        
        var fieldName = networkLayer.compositeRouteIdFieldName;
        var isStringField = utils.isStringField(networkLayer.fields, fieldName);        
        var query = new Query();
        query.where = fieldName + "=" + utils.enquoteFieldValue(routeId, isStringField);
        query.returnGeometry = false;
        query.outFields = [networkLayer.routeNameFieldName];

        var queryUrl = utils.appendUrlPath(mapManager.lrsMapLayerConfig.url, "/" + networkLayer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            var routeName = null;
            if (featureSet && featureSet.features && featureSet.features.length > 0) {
                var feature = featureSet.features[0];
                routeName = feature.attributes ? feature.attributes[networkLayer.routeNameFieldName] : null;
            }
            defd.resolve(routeName);
        }), lang.hitch(this, function(err) {
            defd.reject(err);
        })); 
        return defd;       
    },
    
    /*
     * Returns a Deferred with route ID based on the route name.
     */
    getRouteIdByRouteName: function(networkLayer, routeName, mapManager) {
        var defd = new Deferred();
        if (!networkLayer) {
            console.log("Route name utils: getRouteIdByRouteName: No network layer selected to get a route ID based on the route name.");
            defd.resolve(null);
            return defd;
        }
        
        // Validate the input fields
        if (!routeName) {
            console.log("Route name utils: getRouteIdByRouteName: No route name given.");
            defd.resolve(null);
            return defd;
        }
                
        var fieldName = networkLayer.routeNameFieldName;
        var isStringField = utils.isStringField(networkLayer.fields, fieldName);        
        var query = new Query();
        query.where = fieldName + "=" + utils.enquoteFieldValue(routeName, isStringField);
        query.returnGeometry = false;
        query.outFields = [networkLayer.compositeRouteIdFieldName];

        var queryUrl = utils.appendUrlPath(mapManager.lrsMapLayerConfig.url, "/" + networkLayer.id);
        new QueryTask(queryUrl).execute(query, lang.hitch(this, function(featureSet) {
            var routeId = null;
            if (featureSet && featureSet.features && featureSet.features.length > 0) {
                var feature = featureSet.features[0];
                routeId = feature.attributes ? feature.attributes[networkLayer.compositeRouteIdFieldName] : null;
            }
            defd.resolve(routeId);
        }), lang.hitch(this, function(err) {
            defd.reject(err);
        })); 
        return defd;       
    },
    
    /*
     * Returns true to use route name if auto-generated route name is not configured and the route name is configured.
     */
    useRouteName: function(networkLayer) {
        if (networkLayer) {
            return (!networkLayer.autoGenerateRouteName && networkLayer.routeNameFieldName != null);
        } else {
            return false;
        }
    },
    
    /*
     * Returns either route name field name or route ID field name based on whether route name is being used to display.
     */
    getRouteFieldName: function(networkLayer) {
        return routeNameUtils.useRouteName(networkLayer) ? networkLayer.routeNameFieldName : networkLayer.compositeRouteIdFieldName;
    },
    
    /*
     * Returns either route name or ID label based on whether route name is being used to display.
     */
    getRouteLabel: function(networkLayer) {
        return routeNameUtils.useRouteName(networkLayer) ? nls.routeName : nls.routeId;
    },
    
    /*
     * Returns either From route name or ID label based on whether route name is being used to display.
     */
    getFromRouteLabel: function(networkLayer) {
        return routeNameUtils.useRouteName(networkLayer) ? nls.fromRouteName : nls.fromRouteId;
    },
    
    /*
     * Returns either To route name or ID label based on whether route name is being used to display.
     */
    getToRouteLabel: function(networkLayer) {
        return routeNameUtils.useRouteName(networkLayer) ? nls.toRouteName : nls.toRouteId;
    },
    
    /*
     * Returns either route name or route ID in the error message based on whether route name is being used.
     */
    getRouteErrorMessage: function(networkLayer) {
        return routeNameUtils.useRouteName(networkLayer) ? nls.invalidRouteName : nls.invalidRouteId;
    },

    /*
     * Returns a where clause contains either route ID or route name field and value.
     */
    buildRouteValueWhereClause: function(networkLayer, routeValue) {
        if (routeNameUtils.useRouteName(networkLayer)) {
            return utils.buildWhereClause(networkLayer.routeNameFieldName, routeValue, true);
        } else {
            return utils.buildRouteIdWhereClause(networkLayer, routeValue);
        }
    }
};

return routeNameUtils;
});  // end define
