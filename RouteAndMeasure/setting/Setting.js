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
    "dojo/json",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/form/NumberSpinner",
    "esri/Color",
    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/SimpleMarkerSymbol",
    "jimu/BaseWidgetSetting",
    "jimu/dijit/Message",
    "jimu/dijit/SymbolChooser",
    "jimu/dijit/SymbolPicker"
], function(
    declare, json, WidgetsInTemplateMixin, NumberSpinner, 
    Color, PictureMarkerSymbol, SimpleLineSymbol, SimpleMarkerSymbol, BaseWidgetSetting, Message, SymbolChooser, SymbolPicker
) {
    return declare([BaseWidgetSetting, WidgetsInTemplateMixin], {

        baseClass: 'jimu-widget-lrswidget-setting',
        
        postCreate: function() {
            this.inherited(arguments);
            this.setConfig(this.config);
        },
        
        setConfig: function(config) {
            if (config && this._isValidNumber(config.measurePrecision)) {
                this._measurePrecisionInput.set("value", config.measurePrecision);
            }
            if (config && this._isValidNumber(config.pointZoomLevel)) {
                this._pointZoomInput.set("value", config.pointZoomLevel);
            }
            this._fromMeasureSymbolChooser.showBySymbol(this._getPointSymbol(config, "fromMeasureSymbol"));
            this._toMeasureSymbolChooser.showBySymbol(this._getPointSymbol(config, "toMeasureSymbol"));
            this._lineSelectionSymbolChooser.showBySymbol(this._getLineSymbol(config, "lineSelectionSymbol"));
            this._lineFlashSymbolChooser.showBySymbol(this._getLineSymbol(config, "lineFlashSymbol")); 
        },
        
        getConfig: function() {
            if (!this._measurePrecisionInput.isValid()) {
                this._showMessage(this.nls.invalidMeasurePrecision);
                return false;
            } else if (!this._pointZoomInput.isValid()) {
                this._showMessage(this.nls.invalidPointZoomLevel);
                return false;
            }
            var measurePrecision = this._measurePrecisionInput.get("value");
            var pointZoomLevel = this._pointZoomInput.get("value");
            var fromMeasureSymbol = this._fromMeasureSymbolChooser.getSymbol();
            var toMeasureSymbol = this._toMeasureSymbolChooser.getSymbol();
            var lineSelectionSymbol = this._lineSelectionSymbolChooser.getSymbol();
            var lineFlashSymbol = this._lineFlashSymbolChooser.getSymbol();
            return {
                fromMeasureSymbol: fromMeasureSymbol.toJson(),
                lineSelectionSymbol: lineSelectionSymbol.toJson(),
                lineFlashSymbol: lineFlashSymbol.toJson(),
                toMeasureSymbol: toMeasureSymbol.toJson(),
                measurePrecision: measurePrecision,
                pointZoomLevel: pointZoomLevel
            };
        },
        
        _getLineSymbol: function(config, paramName) {
            if (config && paramName) {                
                var configSymbol = config[paramName];
                if (configSymbol) {
                    return new SimpleLineSymbol(configSymbol);
                } else {
                    return this._getDefaultLineSymbol(paramName);
                }    
            } else {
                return this._getDefaultLineSymbol(paramName);
            }
        },
        
        _getDefaultLineSymbol: function(paramName) {
            var symbol = null;
            switch(paramName) {
                case "lineSelectionSymbol":
                    symbol = new SimpleLineSymbol({
                        "color": [0, 255, 255, 255],
                        "width": 3,
                        "type": "esriSLS",
                        "style": "esriSLSSolid"
                    });
                    break;
                case "lineFlashSymbol":
                    symbol = new SimpleLineSymbol({
                        "color": [0, 100, 0, 255],
                        "width": 3,
                        "type": "esriSLS",
                        "style": "esriSLSSolid"
                    });
                    break;
                default:
                    symbol = new SimpleLineSymbol(
                        SimpleLineSymbol.STYLE_SOLID, 
                        new Color([255, 174, 0]), 
                        4.0
                    );
            }
            return symbol;
        },
        
        _getPointSymbol: function(config, paramName) {
            if (config && paramName) {
                var configSymbol = config[paramName];                
                if (configSymbol) {
                    if (configSymbol.type == "esriSMS") {
                        return new SimpleMarkerSymbol(configSymbol);
                    } else {
                        return new PictureMarkerSymbol(configSymbol);
                    }
                } else {
                    return this._getDefaultPointSymbol(paramName);
                }
            } else {
                return this._getDefaultPointSymbol(paramName);
            }
        },
        
        _getDefaultPointSymbol: function(paramName) {
            var symbol = null;
            switch(paramName) {
                case "fromMeasureSymbol":
                    symbol = new SimpleMarkerSymbol({
                        "color": [0, 192, 0, 255],
                        "size": 13.5,
                        "angle": 0,
                        "xoffset": 0,
                        "yoffset": 0,
                        "type": "esriSMS",
                        "style": "esriSMSCross",
                        "outline": {
                            "color": [0, 192, 0, 255],
                            "width": 3,
                            "type": "esriSLS",
                            "style": "esriSLSSolid"
                        }
                    });
                    break;
                case "toMeasureSymbol":
                    symbol = new SimpleMarkerSymbol({
                        "color": [255, 0, 0, 255],
                        "size": 12,
                        "angle": 0,
                        "xoffset": 0,
                        "yoffset": 0,
                        "type": "esriSMS",
                        "style": "esriSMSX",
                        "outline": {
                            "color": [255, 0, 0, 255],
                            "width": 3,
                            "type": "esriSLS",
                            "style": "esriSLSSolid"
                        }
                    });
                    break;
                default:
                    symbol = new SimpleMarkerSymbol(
                        SimpleMarkerSymbol.STYLE_DIAMOND, 
                        12.0,
                        new SimpleLineSymbol (SimpleLineSymbol.STYLE_SOLID, new Color([255, 174, 0]), 2.0),
                        new Color([255, 211, 128])
                    );
            }
            return symbol;
        },
        
        _isValidNumber: function(value) {
            return (value != null && value !== "" && !isNaN(value));
        },
        
        _showMessage: function(message) {
            var popup = new Message({
                message: message,
                autoHeight: true
            });
        }

    });
});