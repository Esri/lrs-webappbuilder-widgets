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
    "dojo/_base/lang",
    "dojo/dom-style",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/form/Select",
    "jimu/BaseWidget",
    "./fix",
    "./form/_FormWidgetBase",
    "./MapManager",
    "./util/utils",
    "dojo/i18n!./nls/strings",
    "xstyle/css!../css/style.css"
], function(
    declare, lang, domStyle, WidgetsInTemplateMixin, Select, BaseWidget, fix, _FormWidgetBase, MapManager, utils, commonNls
) {
    return declare([BaseWidget, WidgetsInTemplateMixin], {
        
        _mapManager: null, // lrsCommon/js/MapManager
        
        postMixInProperties: function() {
            this.inherited(arguments);
            var amdFolder = this.amdFolder;
            (function() {
                _FormWidgetBase.extend({
                    getAmdFolder: function() {
                        return amdFolder;
                    }
                });
            })();
            this.nls = utils.deepMixin({}, commonNls, this.nls);
        },
        
        /*
         * Finds the LRS layer in the map. 
         * Once the LRS layer is found and loaded, this._onLrsLoaded is called.
         */
        postCreate: function() {
            this.inherited(arguments);
            this.showLoading();
            this._mapManager = new MapManager();
            this._mapManager.map = this.map;
            
            // load config settings
            this._mapManager.pointZoomLevel = utils.isValidNumber(this.config.pointZoomLevel) ? this.config.pointZoomLevel : 16;
            this._mapManager.measurePrecision = utils.isValidNumber(this.config.measurePrecision) ? this.config.measurePrecision : null;
            this._mapManager.setLineSelectionSymbol(this.config.lineSelectionSymbol);
            this._mapManager.setLineFlashSymbol(this.config.lineFlashSymbol);
            this._mapManager.setFromMeasureSymbol(this.config.fromMeasureSymbol);
            this._mapManager.setToMeasureSymbol(this.config.toMeasureSymbol);
            
            // load lrs            
            this._mapManager.loadLrs(this.map).then(lang.hitch(this, function() {
                this._onLrsLoaded();
            }), lang.hitch(this, function(err) {
                var message = this.nls.noLrsServiceDetected;
                if (err) {
                    if (err.mainMessage) {
                        message = err.mainMessage;
                    }
                    if (err.message) {
                        message += "<br><br>" + err.message;
                    }
                }
                this.showError(message, true);
            }));
        },
        
        /*
         * This should be overridden by the subclass widget and used as the starting point for 
         * doing anything with the LRS.
         */
        _onLrsLoaded: function() {
            console.warning("_onLrsLoaded needs to be implemented by the subclass.");    
        },
        
        /*
         * Show a popup message to the user.
         */
        showMessage: function(message) {
            utils.showMessage(message);
        },
        
        /*
         * Shows the busy wheel on the widget. 
         * The content will still be displayed behind the wheel but will be unclickable.
         */
        showBusy: function() {
            domStyle.set(this._busyPanel, "display", "block");
        },
        
       /*
        * Hides the busy wheel on the widget.
        */
        hideBusy: function() {
            domStyle.set(this._busyPanel, "display", "none");
        },
        
        /*
         * Shows the widget content. This should be called after the LRS is loaded.
         */
        showContent: function() {
            domStyle.set(this._loadingPanel, "display", "none");
            domStyle.set(this._errorPanel, "display", "none");
            domStyle.set(this._contentPanel, "display", "");  
        },
        
        /*
         * Hides the content and shows a loading screen.
         */
        showLoading: function() {
            domStyle.set(this._loadingPanel, "display", "");
            domStyle.set(this._errorPanel, "display", "none");
            domStyle.set(this._contentPanel, "display", "none");    
        },
        
        /*
         * Hides the content and shows an error message.
         */
        showError: function(message, hideContent) {
            this._errorPanel.innerHTML = message || this.nls.error;
            domStyle.set(this._errorPanel, "display", "");
            domStyle.set(this._loadingPanel, "display", "none");
            if (hideContent) {
                domStyle.set(this._contentPanel, "display", "none");
            }
        }
        
    });
});