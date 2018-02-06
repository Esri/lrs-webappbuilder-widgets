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
    "esri/lang"
], function(array, esriLang) {
    /*
     * Utility functions for domain (coded value or range).
     */
    var domainUtils = {
        
        /*
         * Returns the coded value domain name based on the code
         */
        findName: function(codedValues, code) {
            var name;
            array.some(codedValues, function(value) {
                if (code == value.code) {
                    name = value.name;
                    return true;
                }
                return false;
            }, this);
            return name;
        },
        
        /*
         * Returns coded values array for subtype fields and coded value domain fields
         * Otherwise returns null
         * 
         * Pass field to include coded value domain
         * Pass field and layer to include subtypes
         * Pass field, layer, and attributes to include domains controlled by a subtype
         */
        getCodedValues: function(field, layer, attributes) {
            var codedValues = null;
            var domainCodedValues = null;
            
            if (field) {   
                // check subtypes  
                var subtypeDomain = false;                  
                if (layer) {
                    if (layer.subtypeFieldName == field.name) {
                        // the field is the subtype field
                        domainCodedValues = layer.subtypes;
                    } else if (layer.subtypes && attributes) {
                        // check if the field is controlled by the subtype field
                        var domain = domainUtils.getSubtypeDomain(field.name, layer, attributes);
                        subtypeDomain = domain ? true : false;
                        if (domain && domain.type == "codedValue") {
                            domainCodedValues = domain.codedValues;
                        }
                    }
                }             
                
                // no subtype so check the field for a domain
                if ((!subtypeDomain) && field.domain && field.domain.type === "codedValue") {
                    domainCodedValues = field.domain.codedValues;
                }  
            }
            
            if (domainCodedValues) {
                codedValues = [];
                array.forEach(domainCodedValues, function(codedValue) {                
                    codedValues.push({name: codedValue.name, code: codedValue.code});
                }, this);
            }
            return codedValues;
        },
        
        /*
         * Returns coded values map of code to name for subtype fields and coded value domain fields
         * Otherwise returns null
         */
        getCodedValuesObject: function(field, layer, attributes) {
            var codedValues = null;
            var arr = domainUtils.getCodedValues(field, layer, attributes);
            if (arr && arr.length > 0) {
                codedValues = {};
                array.forEach(arr, function(codedValue) {
                    codedValues[codedValue.code] = codedValue.name;
                }, this);
            }
            return codedValues;
        },
        
        /*
         * Returns the range or coded value domain of a field that is controlled by a subtype.
         * If the field is not controlled by a subtype, returns null.
         */
        getSubtypeDomain: function(fieldName, layer, attributes) {
            var domain = null;
            if (fieldName && layer && attributes && layer.subtypes && layer.subtypeFieldName != fieldName) {
                var controlValue = attributes[layer.subtypeFieldName];
                if (esriLang.isDefined(controlValue)) {                            
                    array.some(layer.subtypes, function(subtype) {
                        if (subtype.code == controlValue) {
                            domain = subtype.domains[fieldName];
                            return true;
                        }
                        return false;
                    }, this);
                }
            }
            return domain;
        }
    };
    
    return domainUtils;
});  // end define
