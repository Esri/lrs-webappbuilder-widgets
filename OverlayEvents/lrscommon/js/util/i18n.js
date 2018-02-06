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
    "dojo/_base/lang",
    "dojo/date/locale",
    "dojo/number",
    "dojo/string",
    "./utils",
    "dojo/i18n!../nls/strings"
], function(lang, dateLocale, number, string, utils, nls) {
    /*
     * Utility functions for i18n, using locale-specific settings.
     */
    var i18nUtils = {
        /*
         * Formats a numeric value to a specified number of decimal places, rounding when necessary.
         * Returns a string representation of the number in fixed-point notation.
         * An empty string is returned when value is null, undefined, an empty string, or NaN.
         */
        formatNumber: function(/*Number|String*/ value, /*Number?*/ precision) {
            if (i18nUtils.isValidNumber(value)) {                
                // Number of decimal places remains unchanged if precision not provided
                precision = utils.validatePrecision(precision, i18nUtils.getDecimalPlaces(value));
                var str = utils.formatNumber(value, precision);
                var decimalIndex = str.indexOf(".");
                if (decimalIndex == -1) {
                    return str;
                } else {
                    return number.format(str, {
                        pattern: i18nUtils.getPattern(decimalIndex, precision)
                    });
                }
            }
            return value;
        },
        
        /*
         * Formats a numeric value to a specified number of decimal places, rounding when necessary, based on field name.
         * If it's not a measure field, number of decimal places remains unchanged.
         */
        formatByFieldName: function(/*Number|String*/ value, fieldName, layerInfo) {
            // Don't change number of decimal places for non-measure fields
            var precision = null;
            if (fieldName && layerInfo && (fieldName == layerInfo.fromMeasureFieldName || fieldName == layerInfo.toMeasureFieldName || fieldName == layerInfo.measureFieldName)) {
                // Use the default measure precision if the provided precision is invalid
                precision = utils.validatePrecision(layerInfo.measurePrecision, utils.measurePrecision);
            }
            return i18nUtils.formatNumber(value, precision);
        },
        
        /*
         * Formats field value without changing number of decimal places.
         */
        formatFieldValue: function(fieldInfo) {
            return utils.isDecimalType(fieldInfo.type) ? i18nUtils.formatNumber(fieldInfo.defaultValue) : fieldInfo.defaultValue;
        },

        /*
         * Returns number of decimal places.
         */
        getDecimalPlaces: function(/*Number|String*/ value) {
          // toFixed produces a fixed representation accurate to 20 decimal places
          // without an exponent.
          // The ^-?\d*\. strips off any sign, integer portion, and decimal point
          // leaving only the decimal fraction.
          // The 0+$ strips off any trailing zeroes.
          return ((+value).toFixed(20)).replace(/^-?\d*\.?|0+$/g, '').length;
        },
        
        /*
         * Returns true if the input value is a valid number and needs to be converted to a primitive Number, assuming there is no grouping separator.
         * This is often used in widget that's extended from ValidationTextBox which contains numeric/station value since ValidationTextBox doesn't do the number formatting based on current locale.
         */
        needParse: function(/*Number|String*/ value) {
            // Validate the value
            if (!i18nUtils.isValidNumber(value)) {
                return false;
            }
            if (typeof value === "string") {
                return value.indexOf(",") > -1;
            }
            if (typeof value !== "number" || isNaN(value)) {
                return false;
            }
            return value.toFixed(1).indexOf(",") > -1;
        },
        
        /*
         * Returns the pattern for number formatting based on number of digits before and after the decimal mark.
         */
        getPattern: function(beforeDecimalCount, afterDecimalCount) {
            return string.rep("#", beforeDecimalCount) + "." + string.rep("#", afterDecimalCount);
        },
        
        /*
         * Returns the decimal mark based on the current locale.
         */
        getDecimalMark: function() {
            var num = number.format("0.1", { pattern: "#.#" });
            return num.charAt(1);
        },
        
        /*
         * Returns true if comma is used as decimal mark.
         */
        useComma: function() {
            var num = number.format("0.1", {pattern: "#.#"});
            return (num.charAt(1) == ",");
        },
        
        /*
         * Returns the regular expression for validating a number.
         */
        getNumberRegExp: function() {
            if (i18nUtils.useComma()) {
                return utils.numberRegExpComma;
            } else {
                return utils.numberRegExp;
            }
        },

        /*
         * Returns the regular expression in string for validating a number.
         */
        getNumberRegExpFormat: function() {
            return i18nUtils.localizeFormat(utils.numberRegExpFormat);
        },
        
        /*
         * Modifies and returns the regular expression in string based on the current locale.
         */
        localizeFormat: function(format) {
            return format.replace(".", i18nUtils.getDecimalMark());
        },
        
        /*
         * Formats null and date value.
         * 
         * If fieldName and layerInfo are passed, it will only apply precision if the field is a measure field.
         */
        formatValue: function(value, fieldInfo, measurePrecision, hasTime, keepNull, fieldName, layerInfo) {
            // The Identify operation returns 'Null' (for English version of ArcGIS Server) instead of null.  It also returns number and date in the format based on the language setup for ArcGIS Server.
            if (value == null) {
                value = keepNull ? null : nls.nullValue;
            } else if (fieldInfo && fieldInfo.type == "esriFieldTypeDate") {
                if (utils.isTypeOfNumber(value)) {
                    //TODO: Revisit after standardizing the time zone between desktop and server.
                    // Use UTC date at midnight to be consistent with Identify tool (TFS# 31140).
                    var localDate = new Date(value),
                        utcDate = null;
                    if (hasTime) {
                        utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
                        value = i18nUtils.formatDate(utcDate, hasTime);
                    } else {
                        utcDate = new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate());
                        value = i18nUtils.formatDate(utcDate);
                    }
                } else {
                    // Do nothing.
                    // Identify operation returns date/time in locale-specific format instead of number in milliseconds.
                    // Therefore, we just display whatever is returned without formatting.
                }
            } else if (utils.isTypeOfNumber(value)) {
                // Round numbers to a configured precision
                value = i18nUtils.formatByFieldName(value, fieldName, layerInfo);
            } else if (utils.numberRegExp.test(value)) {
                var parsedNumber = number.parse(value, {locale: "en-us"});
                // Make sure the leading zero didn't not get truncated (ex. route ID) and the referent offset value gets formatted
                if (!isNaN(parsedNumber) && parsedNumber.toString() == value) {
                    value = i18nUtils.formatNumber(parsedNumber, measurePrecision);
                }
            }
            return value;
        },
        
        /*
         * Returns true if value is a valid number (even if it is in string form)
         */
        isValidNumber: function(value) {
            if (typeof value === "string") {
                value = number.parse(value);
            }
            return (value != null && value !== "" && !isNaN(value));
        }
    };
    
    return i18nUtils;
});  // end define
