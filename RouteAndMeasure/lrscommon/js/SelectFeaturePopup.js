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
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/Evented",
    "dojo/string",
    "jimu/dijit/Popup",
    "./util/geometry",
    "./util/utils",
    "dojo/i18n!./nls/strings"
], function(
    array, declare, lang, domConstruct, domStyle, Evented, string, Popup, geometryUtils, utils, nls
) {
    return declare([Evented], {
        // Enumeration of display types.
        DisplayTypes: {
            ROUTE: "route",
            LINE: "line"
        },
        
        nls: null,
        _mapManager: null,
        _message: null,
        _label: null,
        _features: null,
        _displayField: null,
        _feature: null,
        
        /// Events ///
        onFeatureSelected: function(feature) { this.emit("featureselected", feature); },
        
        constructor: function(params) {
            this.nls = nls;
            this._mapManager = params.mapManager;
            this._features = params.features;
            this._displayField = params.displayField;
            this.setDisplayType(params.displayType);
        },
        
        destroy: function() {
            if (this._popup) {
                this._selectFeature(null);
            } else {
                this.onFeatureSelected(null);
            }
            this.inherited(arguments);
        },
        
        /*
         * Sets the title, message, and label based on type.
         * Supported types can be found in DisplayTypes enumeration
         */
        setDisplayType: function(/*String*/ type) {
            var DisplayTypes = this.DisplayTypes;
            var featuresLength = this._features ? this._features.length : "";
            var title = "";
            var message = "";
            var label = "";
            
            switch (type) {
                case DisplayTypes.ROUTE:
                    title = this.nls.selectFeaturePopup_routeTitle;
                    message = this.nls.selectFeaturePopup_routeMessage;
                    label = this.nls.selectFeaturePopup_routeLabel;
                    break;
                case DisplayTypes.LINE:
                    title = this.nls.selectFeaturePopup_lineTitle;
                    message = this.nls.selectFeaturePopup_lineMessage;
                    label = this.nls.selectFeaturePopup_lineLabel;
                    break;
                default:
                    title = this.nls.selectFeaturePopup_defaultTitle;
                    message = this.nls.selectFeaturePopup_defaultMessage;
                    label = this.nls.selectFeaturePopup_defaultLabel;
                    break;
            }
            
            this._title = string.substitute(title, [featuresLength]);
            this._message = message;
            this._label = label;
        },
        
        /*
         * Shows the popup to select a feature.
         */
        showPopup: function() {
            this._feature = null;
            var contentDiv = domConstruct.create("div");
            
            domConstruct.create("div", {
                innerHTML: this._message,
                style: "padding-bottom: 5px"
            }, contentDiv);
            
            var featuresTable = domConstruct.create("table", null, contentDiv);
            
            // Create a list of feature items and links to select each feature
            array.forEach(this._features, function(feature, i) {
                var featureId = feature.attributes[this._displayField];
                var escapedFeatureId = featureId ? utils.escapeHtml(featureId) : this.nls.selectFeaturePopup_noFeatureId;
                var tr = domConstruct.create("tr", null, featuresTable);
                var featureTd = domConstruct.create("td", null, tr);
                var showTd = domConstruct.create("td", null, tr);
                
                domConstruct.create("a", {
                    href: "javascript:void(0)",
                    title: this.nls.selectFeaturePopup_selectLabel,
                    innerHTML: escapedFeatureId,
                    onclick: lang.hitch(this, this._selectFeature, feature)
                }, featureTd);
                
                if (geometryUtils.isValid(feature.geometry)) {
                    domConstruct.create("a", {
                        href: "javascript:void(0)",
                        title: this.nls.selectFeaturePopup_viewTooltip,
                        innerHTML: this.nls.selectFeaturePopup_viewLabel,
                        onclick: lang.hitch(this, this._viewFeature, feature),
                        style: "margin: 0px 5px;"
                    }, showTd);
                }
            }, this);
            
            var maxHeight = 110 + (20 * this._features.length);
            maxHeight = maxHeight > 200 ? 200 : maxHeight;
            this._popup = new Popup({
               titleLabel: this._title,
               content: contentDiv,
               buttons: [],
               maxHeight: maxHeight,
               width: 460,
               onClose: lang.hitch(this, function() {
                   this.onFeatureSelected(this._feature);
                   return true;
               })
            });
        },
        
        _getLabel: function(index) {
            var labels = this._label;
            if (labels instanceof Array) {
                return labels[index % labels.length];
            } else {
                return labels;
            }
        },
        
        _selectFeature: function(feature) {
            this._feature = feature;
            this._popup.close();
            this._popup = null;
        },
        
        _viewFeature: function(feature) {
            if (this._mapManager) {
                this._mapManager.flash(feature.geometry);
            }
        }
        
    });
});
