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
    "dojo/dom-style",
    "dojo/query", 
    "dojo/string",
    "esri/urlUtils",
    "jimu/dijit/Message",
    "dojo/i18n!../nls/strings"
], function(
    array, lang, domStyle, domQuery, string, urlUtils, Message, nls
) {
    function deepMixin(dest, /*any number of objects*/ sources) {
        dest = dest || {};
        for (var i = 1, len = arguments.length; i < len; i++) {
            _deepMixin(dest, arguments[i]);
        }
        return dest;
    }
    function _isSimpleObject(obj) {
        return (obj != null) && (obj.constructor === Object);
    }
    function _deepMixin(dest, source) {
        // copied from dojo/lang/_mixin and modified to merge two Objects
        var name, s, empty = {};
        for (name in source) {
            // the (!(name in empty) || empty[name] !== s) condition avoids copying properties in "source"
            // inherited from Object.prototype.  For example, if dest has a custom toString() method,
            // don't overwrite it with the toString() method that source inherited from Object.prototype
            s = source[name];
            if (!(name in dest) || (dest[name] !== s && (!(name in empty) || empty[name] !== s))) {
                if (_isSimpleObject(s) && _isSimpleObject(dest[name])) {
                    dest[name] = deepMixin({}, dest[name], s);
                } else {
                    dest[name] = s;
                }
            }
        }
        return dest;
    }
    
    /*
     * General utility functions.
     */
    var utils = {
        // The default number of decimal places to round/format measure values.
        measurePrecision: 6,
        
        // Regular expressions for integer and floating-point number validation
        integerRegExp: /^-?\d*$/,
        integerRegExpFormat: "^-?\\d*$",
        numberRegExp: /^-?\d*\.?\d*([eE][+-]?\d+)?$/,
        numberRegExpComma: /^-?\d*\,?\d*([eE][+-]?\d+)?$/,
        numberRegExpFormat: "^-?\\d*\\.?\\d*([eE][+-]?\\d+)?$",
        
        // Prevent SQL IN clause from becoming too big
        IN_CLAUSE_BATCH_SIZE: 1000,
        
        shapeFields: [ "shape", "shape.len", "shape_len", "shape_length", "st_length(shape)", "shape.stlength()", "shape_area", "shape.starea()" ],
        
        /*
         * A function that works like dojo.mixin, except that it recursively combines nested object 
         * properties, rather than completely overwriting destination objects with source objects. 
         * This is useful for merging multiple i18n resource bundles that contain nested objects.
         */
        deepMixin: deepMixin,
        
        /*
         * Shows a popup message to the user
         */
        showMessage: function(message, title) {
            var popup = new Message({
                message: message,
                autoHeight: true,
                titleLabel: title
            });
        },
        
        /*
         * Shows a popup error message to the user
         */
        showErrorMessage: function(message, details) {
            message = message || "";
            if (details && details != "") {
                message += "\n\n" + string.substitute(nls.errorDetails, [details]);
            }
            utils.showMessage(message, nls.error);
        },
        
        /*
         * Appends a path component to a URL, ensuring that any URL query parameters are
         * maintained at the end of the URL.
         */
        appendUrlPath: function(/*String*/ url, /*String*/ path) {
            if (url && path) {
                var obj = urlUtils.urlToObject(url);
                obj.query = obj.query || {};
                url = obj.path + path;
                for (var name in obj.query) {
                    // TODO: do we need to URL encode the query values?
                    url += (url.indexOf("?") === -1 ? "?" : "&") + name + "=" + obj.query[name];
                }
            }
            return url;
        },
        
        /*
         * Strips off any query parameters (e.g. token) from a URL.
         */
        removeUrlQuery: function(url) {
            return (url || "").replace(/\?.*$/, "");
        },
        
        /*
         * Returns the first element of the specified array that matches a filter function.
         * If the filter function is not defined, then returns the first element of the array.
         * Returns null if the array is empty or if no elements match the filter.
         */
        first: function(array, filterFunc, scope) {
            if (array) {
                for (var i = 0, len = array.length; i < len; i++) {
                    if (!filterFunc 
                        || (scope && filterFunc.call(scope, array[i], i, array)) 
                        || (!scope && filterFunc(array[i], i, array))
                    ) {
                        return array[i];
                    }
                }
            }
            return null;
        },
        
        /*
         * Returns the last element of the specified array that matches a filter function.
         * If the filter function is not defined, then returns the last element of the array.
         * Returns null if the array is empty or if no elements match the filter.
         */
        last: function(array, filterFunc, scope) {
            if (array) {
                for (var i = array.length - 1; i >= 0; i--) {
                    if (!filterFunc 
                        || (scope && filterFunc.call(scope, array[i], i, array)) 
                        || (!scope && filterFunc(array[i], i, array))
                    ) {
                        return array[i];
                    }
                }
            }
            return null;
        },
        
        /*
         * Finds a layer based on the id. Returns null if no
         * layer is found.
         */
        findLayer: function(/*Number*/ layerId, /*array*/layers) {
            var layer = utils.first(layers, function(candLayer) {
                return candLayer.id == layerId;
            }, this);
            return layer;
        },
        
        /*
         * Finds a layer based on the name. Returns null if no
         * layer is found.
         */
        findLayerByName: function(/*String*/ layerName, /*array*/layers) {
            var layer = utils.first(layers, function(candLayer) {
                return candLayer.name == layerName;
            }, this);
            return layer;
        },
        
        /*
         * Takes an array and returns it with only unique values
         */
        filterUnique: function(arr) {
            var unique = {};
            return array.filter(arr, function(value) {
                if (!unique[value]) {
                    unique[value] = true;
                    return true;
                }
                return false;
            });
        },
        
        /*
         * Returns the field info matching the specified field name, 
         * or null if the field was not found.
         */
        findField: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName) {
            if (fieldInfos && fieldName) {
                fieldName = fieldName.toUpperCase();
                return utils.first(fieldInfos, function(fieldInfo) {
                    return fieldName.localeCompare(fieldInfo.name.toUpperCase()) === 0;
                });
            }
            return null;
        },
        
        /*
         * Concatenates two where clauses using the specified conjunction keyword (defaulting to "AND").
         * Safely handles null, empty, and whitespace values for either where clause.
         */
        concatenateWhereClauses: function(/*String*/ where1, /*String*/ where2, /*String?*/ conjunction) {
            where1 = where1 || "";
            where2 = where2 || "";
            conjunction = conjunction || "AND";
            if (lang.trim(where2)) {
                if (lang.trim(where1)) {
                    where1 = "(" + where1 + ") " + conjunction + " (" + where2 + ")";
                } else {
                    where1 = where2;
                }
            }
            return where1;
        },
        
        /*
         * Validates and returns the precision.
         */
        validatePrecision: function(precision, defaultPrecision) {
            if (typeof precision !== "number" || isNaN(precision)) {
                precision = defaultPrecision;
            }
            precision = (precision < 0) ? 0 : ((precision > 20) ? 20 : precision);        
            return precision;  
        },
        
        /*
         * Formats a numeric value to a specified number of decimal places, rounding when necessary.
         * Returns a string representation of the number in fixed-point notation.
         * An empty string is returned when value is null, undefined, an empty string, or NaN.
         * 
         * If fieldName and layerInfo are passed, it will only apply precision if the field is a measure field.
         */
        formatNumber: function(/*Number|String*/ value, /*Number?*/ precision, /*String*/ fieldName, /*Object*/ layerInfo) {
            precision = utils.validatePrecision(precision, utils.measurePrecision);
            
            // Validate the value
            if (typeof value === "string") {
                value = parseFloat(value);
            }
            if (typeof value !== "number" || isNaN(value)) {
                return "";
            }
            
            var str = null;
            if (fieldName && layerInfo && fieldName != layerInfo.fromMeasureFieldName && fieldName != layerInfo.toMeasureFieldName && fieldName != layerInfo.measureFieldName) {
                str = value.toString();
            } else {
                str = value.toFixed(precision);
            }
            
            // Remove any trailing zeros after the decimal
            if (str.indexOf(".") !== -1) {
                str = str.replace(/0+$/, "").replace(/\.$/, "");
            }
            // Convert "-0" to "0"
            if (str === "-0") {
                str = "0";
            }
            return str;
        },
        
        /*
         * Returns true if the specified field is a string ArcObjects data type (String, GUID, Global ID), false otherwise.
         */
        isStringField: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName) {
            var fieldTypes = ["esriFieldTypeString", "esriFieldTypeGUID", "esriFieldTypeGlobalID"];
            return utils._isFieldType(fieldInfos, fieldName, fieldTypes);
        },
    
        /*
         * Returns true if the specified field is a numeric ArcObjects data type (Integer, Small Integer, OID, Single, Double), false otherwise.
         */
        isNumberField: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName) {
            var fieldTypes = utils.getNumberFieldTypes();
            return utils._isFieldType(fieldInfos, fieldName, fieldTypes);
        },
        
        /*
         * Returns true if the specified field is an integer ArcObjects data type (Integer, Small Integer, OID), false otherwise.
         */
        isIntegerField: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName) {
            var fieldTypes = ["esriFieldTypeInteger", "esriFieldTypeSmallInteger", "esriFieldTypeOID"];
            return utils._isFieldType(fieldInfos, fieldName, fieldTypes);
        },
        
        /*
         * Returns true if the specified field is a date ArcObjects data type (Date), false otherwise.
         */
        isDateField: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName) {
            var fieldTypes = ["esriFieldTypeDate"];
            return utils._isFieldType(fieldInfos, fieldName, fieldTypes);
        },
        
        getNumberFieldTypes: function() {
            return ["esriFieldTypeInteger", "esriFieldTypeSmallInteger", "esriFieldTypeOID", "esriFieldTypeDouble", "esriFieldTypeSingle"];        
        },
        
        /*
         * Returns true if the specified field type is a decimal ArcObjects data type (Double, Single), false otherwise.
         */
        isDecimalType: function(type) {
            return (type == "esriFieldTypeDouble" || type == "esriFieldTypeSingle");
        },
        
        _isFieldType: function(/*Array[Field]*/ fieldInfos, /*String*/ fieldName, /*Array[String]*/ fieldTypes) {
            var fieldInfo = utils.findField(fieldInfos, fieldName);
            return fieldInfo && (array.indexOf(fieldTypes, fieldInfo.type) !== -1);
        },
        
        /*
         * Returns true if type of the specified value is Number.
         */
        isTypeOfNumber: function(value) {
            return (typeof value === "number");
        },
        
        /*
         * Returns the value surrounded by single quotes if it is a string field type.
         * Escapes any special SQL characters, such as single quotes.
         * This is convenient for formatting field values within SQL where clauses.
         */
        enquoteFieldValue: function(value, /*Boolean*/ isStringField) {
            return isStringField ? "'" + utils.escapeSql(value) + "'" : value;
        },
        
        /*
         * Escapes special characters (such as single quote) in SQL string literals.
         */
        escapeSql: function(value) {
            return lang.isString(value) ? value.replace(/'/g, "''") : value;
        },
        
        /*
         * Makes a string html safe by replacing
         * & < > space " ' / 
         * characters with html codes
         */
        escapeHtml: function(string) {
            var entityMap = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;", "/":"&#x2F;", " ":"&nbsp;" };
            return String(string).replace(/[&<>"'\/ ]/g, function (s) {
                return entityMap[s] || s;
            });
        },
        
        /*
         * Builds a where clause based on a line name and the selected network layer.
         */
        buildRouteIdWhereClause: function(networkLayer, routeId) {
            if (routeId) {
                var fieldName = networkLayer.compositeRouteIdFieldName,
                    isStringField = utils.isStringField(networkLayer.fields, fieldName);
                return fieldName + "=" + utils.enquoteFieldValue(routeId, isStringField);            
            } else {
                return null;
            }
        },
        
        getUnitsString: function(units, lowercase) {
            var unitsString = nls[units] ? nls[units] : nls.unknownUnits;
            if (lowercase) {
                unitsString = unitsString.toLowerCase();
            }
            return unitsString;
        },
        
        /*
         * Returns true if value is a valid number (even if it is in string form)
         * Does not work if the string is in a locale that uses different decimal separator (use i18n utils)
         */
        isValidNumber: function(value) {
            return (value != null && value !== "" && !isNaN(value));
        },
        
        /*
         * Returns true if the string is "", null, or undefined
         */
        isEmptyString: function(value) {
            return (value == undefined || value == null || value == "");
        },
        
        /*
         * Returns the object ID field
         */
        getObjectIdField: function(fields) {
            var fieldInfo = utils.first(fields, function(candField) {
                return candField.type === "esriFieldTypeOID";
            }, this);
            return fieldInfo;
        },
        
        /*
         * Returns the lrs specific fields in an event layer
         */
        getLrsFields: function(layer) {
            function addField(field, arr) {
                if (field) {
                    arr.push(field.toLowerCase());
                }
            };
            
            var fields = [];
            addField(layer.eventIdFieldName, fields);
            addField(layer.routeIdFieldName, fields);
            addField(layer.toRouteIdFieldName, fields);
            addField(layer.routeNameFieldName, fields);
            addField(layer.toRouteNameFieldName, fields);
            addField(layer.fromMeasureFieldName, fields);
            addField(layer.toMeasureFieldName, fields);
            addField(layer.measureFieldName, fields);
            addField(layer.fromDateFieldName, fields);
            addField(layer.toDateFieldName, fields);
            addField(layer.locErrorFieldName, fields);
            addField(layer.stationFieldName, fields);
            addField(layer.backStationFieldName, fields);
            addField(layer.stationMeasureDirectionFieldName, fields);
            addField(layer.fromReferentMethodFieldName, fields);
            addField(layer.fromReferentLocationFieldName, fields);
            addField(layer.fromReferentOffsetFieldName, fields);
            addField(layer.toReferentMethodFieldName, fields);
            addField(layer.toReferentLocationFieldName, fields);
            addField(layer.toReferentOffsetFieldName, fields);
            return fields;
        },
        
        /*
         * Returns a new field name that is unique.
         * startName is the desired name. If this name is already taken, numbers will be appended until it is unique
         * fieldNames is an array of current field names (not needed if fields is passed)
         * fields is an array of current fields (not needed if fieldNames is passed)
         */
        getUniqueFieldName: function(startName, fieldNames, fields) {
            if (fields) {
                fieldNames = array.map(fields, function(field) {
                    if (field && field.name) {
                        return field.name.toLowerCase();
                    } else {
                        return "";
                    }
                }, this);
            } else {
                fieldNames = array.map(fieldNames, function(fieldName) {
                    if (fieldName) {
                        return fieldName.toLowerCase();
                    } else {
                        return "";
                    }
                }, this);
            }
            
            var fieldName = startName;
            var count = 1;
            while (array.indexOf(fieldNames, fieldName.toLowerCase()) > -1) {
                fieldName = startName + count;
                count++;
            }
            return fieldName;   
        }
    };
    
    return utils;
});  // end define
