/**
 * Angular directive to recursively display buckets and their schemas (and, when
 * there are object-valued fields, subschemas, and subsubschemas...) in the Data Analysis
 * panel of the QueryUI.
 */
/* global _, angular */

(function() {

  'use strict';

  /*
   * The following routine, from StackOverflow may Mark Lagendijk, allows us to have
   * fully recursive directives (otherwise the browsers goes into an infinite loop).
   * This permits us to display schemas inside schemas inside schemas...
   * http://stackoverflow.com/questions/14430655/recursion-in-angular-directives
   */

  angular.module('qwQuery').factory('MyRecursionHelper', ['$compile', getRecursionHelper]);

  function getRecursionHelper($compile) {
    return {
      /**
       * Manually compiles the element, fixing the recursion loop.
       * @param element
       * @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
       * @returns An object containing the linking functions.
       */
      compile: recursionCompile,
    };

    /**
     * avoid infinite recursion by removing the elements
     */

    function recursionCompile(element, link){
      var compiledContents;
      var contents;

      // Normalize the link parameter
      if(angular.isFunction(link)){
        link = { post: link };
      }

      // Break the recursion loop by removing the contents
      contents = element.contents().remove();
      return {
        pre: ((link && link.pre) ? link.pre : null),
        post: recursionPostCompile
      };

      /**
       * Compiles and re-adds the contents
       */

      function recursionPostCompile(scope, element) {

        // correctly output sample values of type array
        scope.showSamples = function(field) {
          // no samples for object or array types
          if (field.type == 'object' || field.type == 'array')
            return(null);

          if (_.isArray(field.samples)) {
            var result = "e.g., ";

            for (var i =0;i < 3 && i < field.samples.length; i++) {
              var value = field.samples[i];
              if (result.length > 6)
                result += ", ";

              if (_.isArray(value))
                result += JSON.stringify(value);
              else
                result += value;
            }

            return(result);
          }
          else
            return("");
        };


        // convenience function to show the type name
        scope.showFieldType = function(field) {
          var result = "(" + field.type;

          // if it's an array of just one type, say it here
          if (field.type == 'array' && field.items) {
            if (field.items.type)
              result += " of " + field.items.type;
            else if (field.items.length > 0)
              result += " of subtypes";
            else
              result += " of object";
          }

          // if the field is indexed, say so
          if (field.indexed)
            result += ", indexed";

          result += ")";

          // for object fields, note that the subtype follows
          if (field.type == 'object')
            result += ", child type:";

          return(result);
        };

        // Compile the contents
        if(!compiledContents){
          compiledContents = $compile(contents);
        }
        // Re-add the compiled contents to the element
        compiledContents(scope, function(clone){
          element.append(clone);
        });

        // Call the post-linking function, if any
        if(link && link.post){
          link.post.apply(null, arguments);
        }
      }
    }
  }



  //the bucketDisplay directive iterates over a bucket's schema "flavors", and
  //calls the schemaDisplay directive for each flavor.

  angular.module('qwQuery').
  directive('bucketDisplay', ['qwQueryService','qwConstantsService','$uibModal',getBucketDisplay]);

  //var fakePromise = {then: function() {}};
  //var $modal = {open: function() {console.log("fake modal");return(then);}};

  function getBucketDisplay(qwQueryService,qwConstantsService,$uibModal,$scope) {
    //console.log("getBucketDisplay");

    return {
      restrict: 'A',
      scope: { bucket: '=bucketDisplay' },
      //templateUrl: 'template/bucket-display.tmpl',
      template:
        '<a href="" ng-click="changeExpandBucket(bucket)" class="margin-bottom-half text-small">' +
        '<span class="icon fa-caret-down fa-fw" ng-show="bucket.expanded"></span>' +
        '<span class="icon fa-caret-right fa-fw"  ng-hide="bucket.expanded"></span>' +
        '<img ng-show="bucket.passwordNeeded && !bucket.password" style="height:0.75em" src="../_p/ui/query/images/lock.png" />' +
        '<img ng-show="bucket.passwordNeeded && bucket.password" style="height:0.75em" src="../_p/ui/query/images/lock_unlock.png" />' +
        ' {{bucket.id}} <span ng-if="bucket.count > -1">&nbsp;({{bucket.count}})</span></a>' +
        '  <ul class="text-small" ng-if="bucket.expanded">' +
        //   error?
        '    <li class="insights-sidebar-schema" ng-show="bucket.schema_error">{{bucket.schema_error}}</li>' +
        //   for each flavor in the schema...
        '    <li class="insights-sidebar-schema" ng-repeat="flavor in bucket.schema">' +
        //     each schema starts with a pseudo-flavor giving a summary with the number of flavors
        '      <div ng-show="flavor.Summary" class="margin-bottom-half">{{flavor.Summary}}</div>' + //  if a summary line, show it
        //     now the real flavor
        '      <div ng-hide="flavor.Summary" class="semi-bold"><span ng-show="flavor[\'%docs\']">' +
        //       toggles to control showing details
        '        <h href="" ng-click="flavor.Show = !flavor.Show"><span class="icon fa-caret-down fa-fw" ng-show="flavor.Show"></span>' +
        '        <span class="icon fa-caret-right fa-fw"  ng-hide="flavor.Show"></span></a>' +
        //       summary info
        '        Flavor {{$index}}' +
        '        ({{flavor[\'%docs\'] | number:1}}{{"%, "}}{{getNumFields(flavor.properties)}}{{" fields)"}}</span>' +
        '        <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span ng-show="flavor.Flavor">{{"&nbsp;Common: " + flavor.Flavor}}</span></div>' +
        '      <div ng-hide="flavor.hasFields">Flavor {{index}} - no fields found, perhaps binary data, not JSON?</div>' +

        '      <schema-display ng-hide="flavor.Summary || !flavor.Show" schema="flavor" path=""></schema-display>' +

        '      <li ng-show="bucket.indexes.length > 0"><span class="semi-bold">Indexes</span> <ul class="bucket">' +
        '        <li class="index" ng-repeat="index in bucket.indexes">' +
        '        <em>{{index.name}}</em> <span ng-if="index.index_key.length > 0">on {{index.index_key}}</span>'+
        '         <span ng-if="index.condition"> where {{index.condition}}</span>' +
        '        </li>' +
        '      </ul></li>' +
        '  </ul>'
        ,
        link: function (scope) {
          scope.$watch('bucket', function (schema) {
            scope.schema = schema;

            scope.showSchemaControls = qwConstantsService.showSchemas;
            scope.getNumFields = function(schema) {if (schema) return(Object.keys(schema).length); else return 0;};

            /*
             * This function is used to expand bucket descriptions (asking for SASL passwords
             * if necessary)
             */
            scope.changeExpandBucket = function(bucket) {
              if (!scope.showSchemaControls)
                return;

              //console.log("ChangeExpandBucket");
              if (!bucket.expanded) { //bucket is collapsed, expand it
                scope.bucket = bucket;
                bucket.tempPassword = "";
                //console.log("Password required: " + scope.bucket.passwordNeeded);
                //console.log("bucket: " + scope.bucket.id);
                if (bucket.passwordNeeded && !bucket.password) {

                  // open the dialog to ask for a password

                  var promise = $uibModal.open({
                    templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_password_dialog.html',
                    scope: scope
                  }).result;

                  // if they gave us one, try and get the schema to test the password
                  promise.then(function (res) {
                    bucket.password = bucket.tempPassword;
                    qwQueryService.testAuth(bucket,
                        function() {
                      qwQueryService.getSchemaForBucket(bucket);
                      bucket.expanded = true;
                    },function() {
                      bucket.password = null;
                      scope.error_title = "Bucket Password Failure";
                      scope.error_detail = "Incorrect password for bucket '" + bucket.id + "'.";
                      //console.log("Error authenticating: ");
                      $uibModal.open({
                        templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_error_dialog.html',
                        scope: scope
                      });
                    }
                    );
                  }); // end of 'o.k.' from password dialog

                  return; // either way, we're done here
                } // end of entering password

                if (bucket.schema.length == 0)
                  qwQueryService.getSchemaForBucket(bucket);

                bucket.expanded = true;
              }

              else { // bucket is expanded, collapse it
                bucket.expanded = false;
              }
            };

            scope.collapseBucket = //qwQueryService.collapseBucket;
              function(bucket) {
              bucket.expanded = false;
            };
          });
        },
    };
  };



  //the schemaDisplay directive shows the fields of a schema, then recursively shows
  //the subfields of any object-typed fields.


  angular.module('qwQuery').directive('schemaDisplay', getSchemaDisplay);

  function getSchemaDisplay(MyRecursionHelper) {
    return {
      restrict: 'E',
      scope: { schema: '=schema', path:"=path"},
      template:
        '<ul class="insights-sidebar-schema">' +
        '  <li ng-repeat="(name,  field) in schema.properties">' +
        '    <div ng-class="{\'indexed\': field.indexed}" ' +
        '     ng-attr-title="{{showSamples(field)}}"> {{name}} {{showFieldType(field)}}</div>' +
        '    <div ng-if="field.type==\'object\'">' +
        '      <schema-display schema="field" path="path + name + \'.\' "></schema-display></div>' +
        '    <div ng-if="field.type==\'array\' && field.items.length">' +
        '      <ul class="insights-sidebar-schema"><li ng-repeat="schema in field.items">item {{schema.type}}' +
        '        <span ng-if="schema.$schema || schema.type == \'array\'">:<schema-display schema="schema" path="path + name + \'[]\' "></schema-display></li></span>' +
        '      </ul>' +
        '    </div>' +
        '    <div ng-if="field.type==\'array\' && field.items.$schema">' +
        '      <ul class="insights-sidebar-schema"><li>{{name}} subtype:' +
        '        <schema-display schema="field.items" path="path + name + \'[]\' "></schema-display></li>' +
        '      </ul>' +
        '    </div>' +
        '    <div ng-if="field.type==\'array\' && field.items.subtype">' +
        '      <schema-display schema="field.items.subtype" path="path + name + \'[]\' "></schema-display>' +
        '    </div>' +
        '  </li>' +
        '  <li ng-repeat="schema in schema.items">' +
        '    item {{schema.type}} <span ng-hide="schema.type">{{schema}}</span>' +
        '       <span ng-if="schema.$schema || schema.type == \'array\'">:<schema-display schema="schema" path="path + name + \'[]\' "></schema-display></li></span>' +
        '  </li>' +
        '</ul>',
        compile: function(element) {
          return(MyRecursionHelper.compile(element));
        }
    };
  };

})();
