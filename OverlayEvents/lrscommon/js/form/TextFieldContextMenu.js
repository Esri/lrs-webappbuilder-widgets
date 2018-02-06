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
    "dojo/_base/event",
    "dojo/_base/lang",
    "dojo/dom-class", 
    "dojo/dom-construct",
    "dijit/_Widget", 
    "dijit/Menu"
], function(
    array, declare, dojoEvent, lang, domClass, domConstruct, _Widget, Menu
) {
    /*
     * Add a drop down menu to a text field. 
     * For example the "Use the route start/end" context menu on the MeasureValidationTextBox
     */
    return declare([_Widget], {
        _textField: null,  // dijit.form.TextBox or dijit.form.ValidationTextBox
        _menuItems: null,  // dijit.MenuItem[]
        
        // Events
        onOpen: function() {},
        onClose: function() {},
        
        constructor: function(params) {
            params = params || {};
            this._textField = params.textField;
            this._menuItems = params.menuItems;
        },
        
        postCreate: function() {
            this.inherited(arguments);
            try {
                if (this._textField && this._textField.textbox && this._textField.textbox.parentNode) {
                    // Insert a context menu button into the text field
                    var buttonDiv = domConstruct.create("div", {
                        "class": "textFieldContextMenuButton"
                    });
                    var contextMenuDiv = domConstruct.create("div", {
                        id: this.get("id") + "_" + new Date().getTime(),
                        "class": "textFieldContextMenu",
                        // Prevent focus on the text input
                        onmousedown: dojoEvent.stop
                    }, this._textField.textbox.parentNode);
                    domConstruct.place(buttonDiv, contextMenuDiv);
                    
                    // Set the context menu items
                    var menu = new Menu({
                        leftClickToOpen: true,
                        refocus: false,
                        targetNodeIds: [contextMenuDiv],
                        onOpen: lang.hitch(this, function() { this.onOpen(); }),
                        onClose: lang.hitch(this, function() { this.onClose(); })
                    });
                    array.forEach(this._menuItems, function(menuItem) {
                        menu.addChild(menuItem);
                    }, this);
                    
                    // Prevent the context menu button from overlapping a long text value
                    domClass.add(this._textField.textbox, "textFieldContextMenuInput");
                    
                    // If the text field gets disabled, also disable the context menu
                    this._textField.watch("disabled", lang.hitch(this, function() {
                        var disabled = this._textField.disabled;
                        var targetNodes = menu.targetNodeIds;
                        if (disabled) {
                            menu.unBindDomNode(contextMenuDiv); 
                        } else {
                            menu.bindDomNode(contextMenuDiv);
                        }
                        domClass.toggle(buttonDiv, "disabledTextFieldContextMenuButton", disabled);
                        domClass.toggle(contextMenuDiv, "disabledTextFieldContextMenu", disabled);
                    }));
                } else {
                    console.log("There is not a valid text field widget to attach the context menu.");
                }
            } catch (e) {
                console.log("Unable to attach context menu to text field. ", e);
            }
        }
        
    });
});
