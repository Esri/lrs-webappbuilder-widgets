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
    "esri/geometry/Extent",
    "esri/geometry/Multipoint",
    "esri/geometry/Point",
    "esri/geometry/Polyline",
    "esri/geometry/Polygon",
    "esri/units"
], function(
    array, lang, Extent, Multipoint, Point, Polyline, Polygon, Units
) {
/*
 * General utility functions for geometry.
 */
var geometryUtils = {
    create: function(jsonResult) {
        var geometryType = jsonResult.geometryType,
            geometry = jsonResult.geometry;
        
        if (geometry) {
            if (geometryType === "esriGeometryPoint") {
                return new Point(geometry);
            } else if (geometryType === "esriGeometryPolyline") {
                return new Polyline(geometry);
            } else if (geometryType === "esriGeometryPolygon") {
                return new Polygon(geometry);
            } else if (geometryType === "esriGeometryMultipoint") {
                return new Multipoint(geometry);
            }
        }
        return null;
    },
    
    getPoint: function(geometry) {
        var point;
        switch(geometry.type) {
            case "point":
                point = geometry;
                break;
            case "extent":
                point = geometry.getCenter();
                break;
            case "polygon":
                point = geometry.getCentroid();
                break;
            case "polyline":
            case "multipoint":
                point = geometry.getExtent().getCentroid();
                break;
        }
        return point;
    },
    
    // Calculates an appropriate maximum allowable offset for generalizing geometry.
    // Standard values for the "meters" parameter are:
    // - 100 meters when you need only the rough extent of a geometry, e.g. for zooming the map
    // -  10 meters when you need to display a mostly accurate geometry on the map
    //
    maxAllowableOffset: function(meters, mapUnits) {
        if (mapUnits == Units.DECIMAL_DEGREES) {
            return 0.00001 * meters;  // rough estimate of distance at the equator
        } else if (mapUnits != Units.UNKNOWN) {
            return geometryUtils.convertDistance(meters, Units.METERS, mapUnits);
        } else {
            return null;
        }
    },
    
    /*
     * Converts a linear distance from one unit to another unit.
     */
    convertDistance: function(/*Number|String*/ distance, /*String*/ fromUnits, /*String*/ toUnits) {
        if (distance == null || distance === "" || isNaN(distance) 
            || !fromUnits || !toUnits || fromUnits == toUnits) {
            return distance;
        }
        
        // units per meter
        var unitsToFactor = {
            esriCentimeters:   100, 
            esriDecimeters:    10, 
            esriFeet:          3.2808398950131, 
            esriInches:        39.370078740157, 
            esriKilometers:    0.001, 
            esriMeters:        1, 
            esriMiles:         0.00062137119223733, 
            esriMillimeters:   1000, 
            esriNauticalMiles: 0.00053995680345572, 
            esriYards:         1.0936132983377
        };
        if (!(fromUnits in unitsToFactor) || !(toUnits in unitsToFactor)) {
            console.log("lrscommon.utils.geometry.convertDistance: Invalid units detected: from:'"+fromUnits+"', to:'"+toUnits+"'");
            return distance;
        }
        return unitsToFactor[toUnits] / unitsToFactor[fromUnits] * distance;
    },
        
    /*
     * Expands a point into an extent using the specified buffer distance.
     */
    pointToExtent: function(/*Point*/ point, /*Number*/ buffer) {
        return geometryUtils.isValid(point, "point") ? new Extent(
                point.x - buffer,
                point.y - buffer,
                point.x + buffer,
                point.y + buffer,
                point.spatialReference
            ) : null;
    },
    
    /*
     * Returns true if the specified geometry is not null and is valid 
     * for its type (point, multipoint, polyline, polygon).
     * Optionally specify a specific type to also make sure the geometry is of that type
     * An empty geometry is considered invalid.
     */
    isValid: function(/*Geometry*/ geometry, /*Geometry type*/ type) {
        if (!geometry) {
            return false;
        }
        if (type && geometry.type != type) {
            return false;
        }
        try {
            if (geometry.type === "point") {
                var x = geometry.x,
                    y = geometry.y;
                if (x == null || isNaN(x) || y == null || isNaN(y)) {
                    return false;
                }
            } else if (geometry.type === "multipoint") {
                var points = geometry.points;
                if (!points || points.length === 0) {
                    return false;
                }
            } else if (geometry.type === "polyline") {
                var paths = geometry.paths;
                if (!paths || paths.length === 0
                    || !paths[0] || paths[0].length < 2
                ) {
                    return false;
                }
            } else if (geometry.type === "polygon") {
                var rings = geometry.rings;
                if (!rings || rings.length === 0
                    || !rings[0] || rings[0].length < 3
                ) {
                    return false;
                }
            }
        } catch (e) {
            console.log("Unable to check validity of geometry. ", e);
            return false;
        }
        return true;
    }
};

return geometryUtils;
});  // end define
