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
    "dojo/dom-attr",
    "dojo/dom-class",
    "dojo/dom-style",
    "./_FormWidgetBase",
    "dojo/text!./templates/ToggleButton.html"
], function(
    declare, lang, domAttr, domClass, domStyle, _FormWidgetBase, template
) {
	/*
	 * A button that can be toggled on or off
	 * data-width - sets the width of the button (28px default)
	 * data-height - sets the height of the button (28px default)
	 * data-icon - sets the icon for the button
	 *     in CSS define a class with the background-image set to the unselected icon
	 *     define .lrsToggleBtnActive .iconClassName, .lrsToggleBtn:hover .iconClassName with the background-image set to the selected icon
	 */
    return declare([_FormWidgetBase], {
        
        templateString: template,
        
        // events
        onChange: function(isOn) {},
        
        startup: function() {
            var iconClass = domAttr.get(this.domNode, "data-icon");
            var width = domAttr.get(this.domNode, "data-width");
            var height = domAttr.get(this.domNode, "data-height");
            if (iconClass) {
                domClass.add(this._icon, iconClass);
            } else {
                domStyle.set(this._icon, "display", "none");
                domStyle.set(this.containerNode, "padding", "0px 5px");
            }
            if (!this.containerNode.innerHTML) {
                domStyle.set(this.containerNode, "display", "none");
            }
            if (width) {
                domStyle.set(this._icon, "width", width);
            }
            if (height) {
                domStyle.set(this._icon, "height", height);
                domStyle.set(this.containerNode, "lineHeight", height);
            }
        },
        
        isOn: function() {
            return domClass.contains(this.domNode, "lrsToggleBtnActive");
        },
        
        turnOff: function() {
            if (this.isOn()) {
                domClass.remove(this.domNode, "lrsToggleBtnActive");
                domClass.add(this.domNode, "lrsToggleBtnUnactive");
                this.onChange(this.isOn());                
            }
        },
        
        turnOn: function() {
            if (!this.isOn()) {
                domClass.remove(this.domNode, "lrsToggleBtnUnactive");
            	domClass.add(this.domNode, "lrsToggleBtnActive");
                this.onChange(this.isOn());
            }
        },
        
        toggle: function() {
        	if (this.isOn()) {
        		this.turnOff();
        	} else {
        		this.turnOn();
        	}
        },
        
        _onBtnClick: function(evt) {
            this.toggle();
        }
        
    });
});
