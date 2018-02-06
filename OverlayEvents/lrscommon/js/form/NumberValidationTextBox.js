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
    "dojo/_base/declare",
    "dojo/number",
    "dojo/on",
    "dijit/form/ValidationTextBox",
    "../util/i18n",
    "../util/utils"
], function(
    declare, number, on, ValidationTextBox, i18nUtils, utils
) {
    /*
     * A specialized validating TextBox control that handles measure values.
     * Formats/rounds values to a precise number of decimal places.
     * A networkLayer and routeId must be set for the measure to be validated.
     */
    return declare([ValidationTextBox], {
        precision: null,
        regExp: i18nUtils.getNumberRegExpFormat(),
        _validNumber: true,
        
        postCreate: function() {
            this.inherited(arguments);
            this.own(
                on(this, 'keydown', function(evt) {
                    this._validNumber = true;
                })
            );
        },
        
        /*
         * Returns the value of the textbox as a number.
         * Returns null if the value of the textbox is not a valid number.
         */
        getNumberValue: function() {
            var value = number.parse(this.get("value"));
            return utils.isValidNumber(value) ? value : null;
        },
        
        /*
         * Formats a number into a localized string with correct precision
         */
        formatNumber: function(val) {
            if (i18nUtils.needParse(val)) {
                val = number.parse(val);
            }
            var precision = utils.isValidNumber(this.precision) ? this.precision : null;
            val = i18nUtils.formatNumber(val, precision);
            return val;
        },
        
        /*
         * Validates the number is actually valid when user tabs away from measure text box 
         * or when the text box is unfocused. In case the number ends in the decimal separator.
         */
        _onBlur: function() {
            this._validateNumber();
            this.inherited(arguments);
        },
        
        _validateNumber: function() {
            var typedValue = this.get("value");
            if (typedValue == "" || typedValue == null || typedValue == undefined) {
                this._validNumber = true;
            } else {
                this._validNumber = this.getNumberValue() != null;
            }
        },
        
        _setValueAttr: function(/*String|Number*/ value, /*Boolean?*/ priorityChange, /*String?*/ formattedValue) {
            value = this.formatNumber(value);
            this.inherited(arguments, [value, priorityChange, formattedValue]);
        },
        
        /*
         * Overrides the function of ValidationTextBox to include check of whether
         * the number ends in decimal separator.
         */
        validator: function(/*anything*/ value, /*dijit.form.ValidationTextBox.__Constraints*/ constraints) {   
            this._validateNumber();            
            return this._validNumber && this.inherited(arguments);
        }
    });
});  // end define
