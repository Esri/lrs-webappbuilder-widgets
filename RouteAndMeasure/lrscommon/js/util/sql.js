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
], function(
) {
    /*
     * Utility functions for SQL.
     */
    var sqlUtils = {
        
        IN_CLAUSE_BATCH_SIZE: 1000,
        
        /*
         * Builds a SQL IN clause for a field name and value list.
         * If the number of values exceeds the limit for an IN clause, then the values
         * are split among multiple IN clauses that are OR'ed together.
         */
        buildSqlInClause: function(values, startIndex, endIndex, fieldName, isStringType) {
            // Oracle DB has a hard limit on the number of values in a SQL IN clause
            var limit = sqlUtils.IN_CLAUSE_BATCH_SIZE;
            if (values == null || values.length == 0) {
                return "";
            } else {
                var sql = '(';
                for (var i = startIndex; i < endIndex; i += limit) {
                    if (i > startIndex) {
                        sql += " OR ";
                    }
                    var subValues = values.slice(i, Math.min(i + limit, endIndex));
                    if (isStringType) {
                        sql += fieldName + " IN ('";
                        sql += subValues.join("','");
                        sql += "')";
                    } else {
                        sql += fieldName + " IN (";
                        sql += subValues.join(',');
                        sql += ')';
                    }
                }
                sql += ')';
                return sql;
            }
        }
    };
    
    return sqlUtils;
});  // end define
