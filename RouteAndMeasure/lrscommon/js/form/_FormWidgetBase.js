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
    "dijit/_TemplatedMixin",
    "dijit/_WidgetBase",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/i18n!../nls/strings"
], function(
    declare, TemplatedMixin, WidgetBase, WidgetsInTemplateMixin, nls
) {
    /*
     * Base class for templated form widgets
     */
    return declare([WidgetBase, TemplatedMixin, WidgetsInTemplateMixin], {
        
        nls: null,
        amdFolder: null,
        
        constructor: function(params) {
            this.nls = nls;
            this.amdFolder = this.getAmdFolder();
        },
        
        destroy: function() {
            this.inherited(arguments);
            delete this.nls;
        }
    });
});
