/**
 * A controller for managing a document editor based on queries
 */

(function() {


  angular.module('qwQuery').controller('qwDocEditorController', docEditorController);

  docEditorController.$inject = ['$rootScope', '$scope', '$http','$uibModal', '$timeout', '$q', '$stateParams',
    'qwQueryService', 'validateQueryService', 'qwConstantsService', 'mnPermissions','qwFixLongNumberService','$state'];

  function docEditorController ($rootScope, $scope, $http, $uibModal, $timeout, $q, $stateParams, qwQueryService,
      validateQueryService, qwConstantsService, mnPermissions, qwFixLongNumberService, $state) {

    var dec = this;

    //
    // Do we have a REST API to work with?
    //

    dec.validated = validateQueryService;

    //
    // for persistence, keep some options in the query_service
    //

    dec.options = qwQueryService.doc_editor_options;
    dec.options.doc_id = null;
    dec.options.current_result = [];
    dec.currentDocs = [];
    dec.buckets = [];
    dec.buckets_ephemeral = {};
    dec.use_n1ql = function() {return(validateQueryService.valid() && queryableBucket())};
    dec.hideAllTooltips = false;
    dec.resultSize = function() {if (_.isArray(dec.options.current_result)) return dec.options.current_result.length;
                      else return null;};

    function queryableBucket() {
      if (!dec.options.selected_bucket)
        return(false);

      for (var i=0; i< qwQueryService.buckets.length; i++)
        if (qwQueryService.buckets[i].id == dec.options.selected_bucket &&
            (qwQueryService.buckets[i].has_prim || qwQueryService.buckets[i].has_sec))
            return(true);

      return(false);
    }

    //
    //
    //

    dec.retrieveDocs = retrieveDocs;
    dec.createBlankDoc = createBlankDoc;
    dec.nextBatch = nextBatch;
    dec.prevBatch = prevBatch;

    //dec.clickedOn = function(row) {console.log("clicked on: " + row);};
    dec.updateDoc = updateDoc;
    dec.copyDoc = copyDoc;
    dec.deleteDoc = deleteDoc;
    dec.editDoc = editDoc;

    dec.updatingRow = -1;

    dec.bucketChanged = function(item) {if (!item) return; $state.go('app.admin.doc_editor',{bucket: item});};
    dec.rbac = mnPermissions.export;

    //
    // call the activate method for initialization
    //

    activate();

    //
    // get the next or previous set of documents using paging
    //

    function prevBatch() {
      checkUnsavedChanges(function() {
        dec.options.offset -= dec.options.limit;
        if (dec.options.offset < 0)
          dec.options.offset = 0;
        retrieveDocs_inner();
      });
    }

    function nextBatch() {
      // don't fetch data if unsaved changes
      checkUnsavedChanges(function() {
        dec.options.offset += dec.options.limit;
        retrieveDocs_inner();
      });
    }

    //
    // function to update a document given what the user typed
    //

    function updateDoc(row, form) {
      if (dec.updatingRow >= 0)
        return;

      dec.updatingRow = row;

      var newJson = JSON.stringify(dec.options.current_result[row].data);
      var promise = saveDoc(row,newJson);

      // if it succeeded, mark the row as clean
      promise.then(function success() { // errors are handled by saveDoc()
        form.$setPristine();
        dec.updatingRow = -1;
      });
    }

    //
    // create a blank document
    //

    function createBlankDoc() {
      // bring up a dialog to get the new key

      var dialogScope = $rootScope.$new(true);

      // default names for save and save_query
      dialogScope.file = {name: ''};
      dialogScope.header_message = "Add Document";
      dialogScope.body_message = "New Document ID ";

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/file_dialog/qw_input_dialog.html',
        scope: dialogScope
      }).result;

      promise.then(function success(resp) {

        var res = showDocEditor(dialogScope.file.name,
            '{\n"click": "to edit",\n"with JSON": "there are no reserved field names"\n}');

        res.promise.then(function success(resp) {
          var newJson = res.scope.editor.getSession().getValue();
          //console.log("saving new doc: " + newJson);
          saveDoc(-1,newJson,res.scope.doc_id).then(function success(res) {
            $timeout(refreshUnlessUnsaved,100);
          }, function error(resp) {
            console.log("Error saving doc");;
          });
        });

      });
    }

    //
    // function to save a document with a different key
    //

    function copyDoc(row, form) {
      if (dec.updatingRow >= 0)
        return;

      // bring up a dialog to get the new key

      var dialogScope = $rootScope.$new(true);

      // default names for save and save_query
      dialogScope.file = {name: dec.options.current_result[row].id + '_copy'};
      dialogScope.header_message = "Save As";
      dialogScope.body_message = "New Document Key ";

      hideTooltips()
      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/file_dialog/qw_input_dialog.html',
        scope: dialogScope
      }).result;
      promise.then(allowTooltips,allowTooltips); // allow tooltips to show again

      promise.then(function success(resp) {
        dec.updatingRow = row;

        var promise;
        if (dec.options.current_result[row].rawJSON)
          promise = saveDoc(row,dec.options.current_result[row].rawJSON,dialogScope.file.name);
        else
          promise = saveDoc(row,JSON.stringify(dec.options.current_result[row].data),dialogScope.file.name);

        // did the query succeed?
        promise.then(function success(resp) {
          //console.log("successfully copied form: " + form);
          dec.updatingRow = -1;
          if (!resp.data.errors) {
            form.$setPristine();
            $timeout(refreshUnlessUnsaved,100);
          }
        },

        // ...or fail?
        function error(resp) {
          var data = resp.data, status = resp.status;

          //showErrorDialog("Error Copying Document", JSON.stringify(data),true);
          dec.updatingRow = -1;
        });

      });
    }


    //
    // function to delete a document
    //

    function deleteDoc(row) {
      if (dec.updatingRow >= 0)
        return;

      //
      // make sure they really want to do this
      //

      hideTooltips();
      var promise = showErrorDialog("Delete Document",
          "Warning, this will delete the document: " + dec.options.current_result[row].id);
      promise.then(allowTooltips,allowTooltips); // allow tooltips to show again

      promise.then(function success(res) {
        dec.updatingRow = row;

        var promise = deleteDoc_rest(row);

        // did the query succeed?
        promise.then(function(resp) {
          //console.log("successfully deleted row: " + row);
          dec.updatingRow = -1;
          dec.options.current_result[row].deleted = true;
        },

        // ...or fail?
        function error(resp) {
          var data = resp.data, status = resp.status;

          showErrorDialog("Error Deleting Document",JSON.stringify(data)).then(function() {
            dec.updatingRow = -1;
          });
        });
      });
    }

    function deleteDoc_rest(row) {
      var Url = "../pools/default/buckets/" + encodeURIComponent(dec.options.current_bucket) +
     "/docs/" + encodeURIComponent(dec.options.current_result[row].id);

      return $http({
        method: "DELETE",
        url: Url
      });
    }

    //
    // function to edit the JSON of a document
    //

    function editDoc(row,readonly) {
      if (dec.updatingRow >= 0)
        return;

      var doc_string;

      // if we have raw JSON with long numbers, let the user edit that
      if (dec.options.current_result[row].rawJSON)
        doc_string = js_beautify(dec.options.current_result[row].rawJSON,{"indent_size": 2});

      // handle empty documents
      else if (!dec.options.current_result[row].data)
        doc_string = "";

      // otherwise create a string from the underlying data
      else
        doc_string = JSON.stringify(dec.options.current_result[row].data,null,2);

      var meta_obj = {meta: dec.options.current_result[row].meta,
          xattrs: dec.options.current_result[row].xattrs};
      var meta_str = "'" + JSON.stringify(meta_obj,null,2).replace(/\n/g,'<br>').replace(/ /g,'&nbsp;') + "'";
      var res = showDocEditor(dec.options.current_result[row].id, doc_string,meta_str,readonly);
      res.promise.then(getSaveDocClosure(res.scope,row));
    }

    //
    // bring up the JSON editing dialog for edit or create new documents
    //

    function showDocEditor(id,json,meta,readonly) {
      var dialogScope = $rootScope.$new(true);

      // use an ACE editor for editing the JSON document
      dialogScope.ace_options = {
          mode: 'json',
          showGutter: true,
          useWrapMode: true,
          onChange: function(e) {
            if (dialogScope.editor && dialogScope.editor.getSession().getValue().length > 1024*1024) {
              dialogScope.error_message = "Documents larger than 1MB may not be edited.";
              dialogScope.$applyAsync(function() {});
            }
          },
          onLoad: function(_editor) {
            _editor.$blockScrolling = Infinity;
            _editor.renderer.setPrintMarginColumn(false); // hide page boundary lines
            dialogScope.editor = _editor;
            _editor.setReadOnly(readonly);
            _editor.getSession().on("changeAnnotation", function() {
              var annot_list = _editor.getSession().getAnnotations();
              if (annot_list && annot_list.length) for (var i=0; i < annot_list.length; i++)
                if (annot_list[i].type == "error") {
                  dialogScope.error_message = "Error on row: " + annot_list[i].row + ": " + annot_list[i].text;
                  dialogScope.$applyAsync(function() {});
                  return;
                }
              if (dialogScope.editor && dialogScope.editor.getSession().getValue().length < 1024*1024) {
                dialogScope.error_message = null; // no errors found
                dialogScope.$applyAsync(function() {});
              }
            });
            if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
              _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari
          },
          $blockScrolling: Infinity
      };

      dialogScope.doc_id = id;
      dialogScope.doc_json = json;
      dialogScope.doc_meta = meta;
      dialogScope.header = "Edit Document";
      dialogScope.readonly = readonly;


      // are there any syntax errors in the editor?
      dialogScope.errors = function() {
        if (dialogScope.editor) {
          var annot_list = dialogScope.editor.getSession().getAnnotations();
          if (annot_list && annot_list.length)
            for (var i=0; i < annot_list.length; i++)
              if (annot_list[i].type == "error") {
                return true;
              }

          // don't allow empty documents or documents > 1MB
          if ((dialogScope.editor.getSession().getValue().trim().length == 0) ||
              (dialogScope.editor.getSession().getValue().trim().length > 1024*1024))
            return true;
          }
        return false;
      };


      //
      // put up a dialog box with the JSON in it, if they hit SAVE, save the doc, otherwise
      // revert
      //

      hideTooltips(); // hide any existing tooltipys
      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/data_display/qw_doc_editor_dialog.html',
        scope: dialogScope
      }).result;

      promise.then(allowTooltips,allowTooltips); // allow tooltips to show again

      return({scope:dialogScope, promise:promise});
    }

    function hideTooltips() {dec.hideAllTooltips = true;}
    function allowTooltips() {dec.hideAllTooltips = false;}

    // need to remember the dialogScope and row in the promise resolution

    function getSaveDocClosure(dialogScope,row) {
      return function(res) {
        var newJson = dialogScope.editor.getSession().getValue();
        saveDoc(row,newJson).then(refreshUnlessUnsaved());
      }
    }

    //
    // functions to save the document back to the server
    //

    function saveDoc(row,newJson,newKey) {
      dec.updatingRow = row;

      var promise = saveDoc_rest(row,newJson,newKey);

      promise
      // did the query succeed?
      .then(function(resp) {
        var data = resp.data, status = resp.status;
        if (data.errors) {
          handleSaveFailure(newKey,data.errors);
        }

        dec.updatingRow = -1;
      },

      // ...or fail?
      function error(resp) {
        var errors = resp;
        if (resp.errors)
          errors = resp.errors;
        else if (resp.data)
          errors = resp.data;

        handleSaveFailure(newKey,errors);
        dec.updatingRow = -1;
      });

      return(promise);
    }

    //
    // show dialog with error message about save failure
    //

    function handleSaveFailure(newKey,errors) {
      var title = newKey ? "Error Inserting New Document" : "Error Updating Document";

      showErrorDialog(title, 'Errors from server: ' + JSON.stringify(errors), true);
    }


    function saveDoc_rest(row,newJson,newKey) {
      var Url = "/pools/default/buckets/" + encodeURIComponent(dec.options.current_bucket) +
      "/docs/" + (newKey ? encodeURIComponent(newKey) : encodeURIComponent(dec.options.current_result[row].id));


      // with newKey, we need to check if the document exists first by that key

      if (newKey) {
        return $http({
          method: "GET",
          url: Url
        }).then(function success(resp) {
          return($q.reject({data: "Can't save document, key '" + newKey + "' already exists."}));
        },
        function fail(resp) {
          return $http({
            method: "POST",
            url: Url,
            data: {
              flags: 0x02000006,
              value: newJson
            }
          });
        });
      }

      // otherwise just save the doc using the REST api
      else return $http({
        method: "POST",
        url: Url,
        data: {
          flags: 0x02000006,
          value: newJson
        }
      });
    }

    //
    // warn the user about unsaved changes, if any
    //

    function checkUnsavedChanges(ifOk,ifCancel) {
      // warn the user if they try to get more data when unsaved changes
      if ($('#somethingChangedInTheEditor')[0]) {

        var promise = showErrorDialog("Warning: Unsaved Changes", "You have unsaved changes. Continue and lose them?", false);

        // they clicked yes, so go ahead
        promise.then(function success() {
          ifOk();
        },function cancel() {if (ifCancel) ifCancel();});
      }
      // if there are no unsaved changes, just go ahead
      else
        ifOk();
    }
    //
    // build a query from the current options, and get the results
    //

    dec.options.queryBusy = false;

    function retrieveDocs() {
      checkUnsavedChanges(retrieveDocs_inner);
    }

    function retrieveDocs_inner() {
      qwQueryService.saveStateToStorage();

      // special case - when first loading the page, the QueryService may not have gotten all
      // the bucket information yet. If we want to use n1ql, but can't do so yet, put up a message
      // asking the user to click "retrieve"

      if (validateQueryService.valid() &&
          (dec.options.where_clause || dec.buckets_ephemeral[dec.options.selected_bucket]) &&
          !qwQueryService.buckets.length) { // no bucket info yet
        dec.options.current_query = dec.options.selected_bucket;
        dec.options.current_bucket = dec.options.selected_bucket;
        dec.options.current_result =  "Connection to query service not quite ready. Click 'Retrieve Docs' to see data.";
        return;
      }

      // only use query service if there is a 'where' clause or an ephemeral bucket

      if (dec.use_n1ql() && (dec.options.where_clause || dec.buckets_ephemeral[dec.options.selected_bucket]))
        retrieveDocs_n1ql();
      else
        retrieveDocs_rest();
    }


    function retrieveDocs_n1ql() {
      if (dec.options.queryBusy) // don't have 2 retrieves going at once
        return;

      //console.log("Retrieving docs via N1QL...");

      // create a query based on either limit/skip or where clause

      // can't do anything without a bucket
      if (!dec.options.selected_bucket || dec.options.selected_bucket.length == 0)
        return;

      // start making a query that only returns doc IDs
      var query = 'select meta().id from `' + dec.options.selected_bucket + '` data ';

      if (dec.options.where_clause && dec.options.where_clause.length > 0)
        query += 'where ' + dec.options.where_clause;

      query += ' order by meta().id ';

      if (dec.options.limit && dec.options.limit > 0) {
        query += ' limit ' + dec.options.limit + ' offset ' + dec.options.offset;
      }

      dec.options.current_query = query;
      dec.options.current_bucket = dec.options.selected_bucket;
      dec.options.current_result = [];

      dec.options.queryBusy = true;
      qwQueryService.executeQueryUtil(query,true)

      // did the query succeed?
      .then(function success(resp) {
        var data = resp.data, status = resp.status;

        //console.log("Editor Q Success Data: " + JSON.stringify(data.results));
        //console.log("Editor Q Success Status: " + JSON.stringify(status));

        dec.options.current_result = [];
        var idArray = [];

        for (var i=0; i < data.results.length; i++)
          idArray.push(data.results[i].id);

        // we get a list of document IDs, create an array and retrieve detailed docs for each
        if (data && data.status && data.status == 'success') {
          getDocsForIdArray(idArray).then(function() {dec.options.queryBusy = false;});
        }

        else if (data.errors) {
          var errorText = "";
          for (var i=0; i< data.errors.length; i++)
            errorText += "Code: " + data.errors[i].code + ', Message: "' + data.errors[i].msg + '"    \n';

          showErrorDialog("Error with document retrieval query.", errorText, true);

          dec.options.queryBusy = false;
        }

        // shouldn't get here
        else {
          dec.options.queryBusy = false;
         console.log("N1ql Query Fail/Success, data: " + JSON.stringify(data));
        }
      },

      // ...or fail?
      function error(resp) {
        var data = resp.data, status = resp.status;
        //console.log("Editor Q Error Data: " + JSON.stringify(data));
        //console.log("Editor Q Error Status: " + JSON.stringify(status));

        if (data && data.errors) {
          dec.options.current_result = JSON.stringify(data.errors);

          var errorText = "";
          for (var i=0; i< data.errors.length; i++)
            errorText += "Code: " + data.errors[i].code + ', Message: "' + data.errors[i].msg + '"    \n';

          showErrorDialog("Error with document retrieval query.", errorText, true);

          //console.log("Got error: " + dec.options.current_result);
        }
        dec.options.queryBusy = false;
      });

    }

    //
    // given an array of IDs, get the documents, metadata, and xattrs for each ID, and put
    // them into the current result
    //

    function getDocsForIdArray(idArray) {
      var promiseArray = [];

      //console.log("Getting docs for: " + JSON.stringify(idArray));
      dec.options.current_result.length = idArray.length;

      for (var i=0; i< idArray.length; i++) {
        var rest_url = "../pools/default/buckets/" + encodeURIComponent(dec.options.selected_bucket) +
          "/docs/" + encodeURIComponent(idArray[i]);
        //console.log("  url: " + rest_url);

        promiseArray.push($http({
          url: rest_url,
          method: "GET"
        }).then(getDocReturnHandler(i),
            getDocReturnErrorHandler(i,idArray[i])));
      }

      return $q.all(promiseArray);
    }

    //
    // callback when we retrieve a document that belongs in a certain spot in the
    // results array
    //

    function getDocReturnHandler(position) {
      return function success(resp) {
        if (resp && resp.status == 200 && resp.data) {

          var docInfo = resp.data;
          var docId = docInfo.meta.id;
          var doc = qwFixLongNumberService.fixLongInts('{ "data": ' + docInfo.json + '}');
          //console.log("Got single doc results for " + position + ": " + JSON.stringify(doc));

          // did we get a json doc back?
          if (docInfo && docInfo.json && docInfo.meta) {
            docInfo.meta.type = "json";
            dec.options.current_result[position] =
              {id: docId, docSize: docInfo.json.length, data: doc.data, meta: docInfo.meta,
                xattrs: docInfo.xattrs, rawJSON: doc.rawJSON ? docInfo.json : null, rawJSONError: doc.rawJSONError};
          }

          // maybe a single binary doc?
          else if (docInfo && docInfo.meta && (docInfo.base64 === "" || docInfo.base64)) {
            docInfo.meta.type = "base64";
            dec.options.current_result[position] =
              {id: docInfo.meta.id, base64: docInfo.base64, meta: docInfo.meta, xattrs: docInfo.xattrs};
          }

          else
            console.log("Unknown document: " + JSON.stringify(docInfo));
        }
      }
    }

    function getDocReturnErrorHandler(position,id) {
      return function error(resp) {
        var data = resp.data, status = resp.status;
        //console.log("Got REST error status: " + status + ", data: " + JSON.stringify(data));
        dec.options.current_result[position] = {id: id, data: {}, meta: {type:"json"}, xattrs: {}, error: true};

        if (data && data.errors) {
          dec.options.current_result[position].data = {"_ERROR": JSON.stringify(data.errors)};
          showErrorDialog("Error with document: " + id,  JSON.stringify(data.errors), true);
        }
        else if (resp.statusText) {
          dec.options.current_result[position].data = {"_ERROR": JSON.stringify(resp.statusText)};
          showErrorDialog("Error with document: " + id,  JSON.stringify(resp.statusText), true);
        }
      }
    }

    //
    // Show an error dialog
    //

    function showErrorDialog(title, detail, hide_cancel) {
      var dialogScope = $rootScope.$new(true);
      dialogScope.error_title = title;
      dialogScope.error_detail = detail;
      dialogScope.hide_cancel = hide_cancel;
      return $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_error_dialog.html',
        scope: dialogScope
      }).result;
     }

    //
    // get the documents using the REST API
    //

    function retrieveDocs_rest() {

      if (dec.options.queryBusy) // don't have 2 retrieves going at once
        return;

      dec.options.current_query = dec.options.selected_bucket;

      // validate fields
      if (!_.isNumber(dec.options.limit) || dec.options.limit < 1 || dec.options.limit > 200) {
        dec.options.current_result = "Invalid value for 'limit': Limit must be a number between 1 and 200";
        return;
      }

      if (!_.isNumber(dec.options.offset) || dec.options.offset < 0) {
        dec.options.current_result = "Invalid value for 'offset': Offset must be a number >= 0";
        return;
      }

      if (!_.isString(dec.options.selected_bucket) || dec.options.selected_bucket == "") {
        dec.options.current_result = "No selected bucket.";
        return;
      }

      if (dec.options.doc_id)
        dec.options.current_query += ', document id: ' + dec.options.doc_id;

      else
        dec.options.current_query += ", limit: " +
          dec.options.limit + ", offset: " + dec.options.offset;

      // can only use REST API to retrieve single docs from emphemeral buckets
      if (!dec.options.doc_id && dec.buckets_ephemeral[dec.options.selected_bucket]) {
        dec.options.current_bucket = dec.options.selected_bucket;
        dec.options.current_result =
            "Ephemeral buckets can only be queried by document ID, or via a primary or secondary GSI index.";
        return;
      }

      // get the stats from the Query service
      dec.options.queryBusy = true;
      dec.options.current_result = [];

      // we just get a single ID if they specified a doc_id
      if (dec.options.doc_id && dec.options.doc_id.length) {
        getDocsForIdArray([dec.options.doc_id]).then(function()
            {
              //console.log("results: " + JSON.stringify(dec.options.current_result));
              dec.options.queryBusy = false;
             });
        return;
      }

      // otherwise get a list of IDs
      var rest_url = "../pools/default/buckets/" + dec.options.selected_bucket +
        "/docs?skip=" + dec.options.offset + "&include_docs=false&limit=" + dec.options.limit;

      $http({
        url: rest_url,
        method: "GET"
      }).then(function success(resp) {
        if (resp && resp.status == 200 && resp.data) {
          dec.options.current_bucket = dec.options.selected_bucket;
          dec.options.current_result.length = 0;

          var data = resp.data;

          //console.log("Got REST results: " + JSON.stringify(data));

          // we asked for a set up of document ids
          if (data && data.rows) {
            var idArray = [];
            for (var i=0; i< data.rows.length; i++) {
              idArray.push(data.rows[i].id);
            }

            getDocsForIdArray(idArray).then(function() {
              //console.log("results: " + JSON.stringify(dec.options.current_result));
              dec.options.queryBusy = false;
              });
          }
          //console.log("Current Result: " + JSON.stringify(dec.options.current_result));
        }
      },function error(resp) {
        var data = resp.data, status = resp.status;
        //console.log("Got REST error status: " + status + ", data: " + JSON.stringify(data));

        if (data) {
          if (data.errors)
            dec.options.current_result = JSON.stringify(data.errors);
          else
            dec.options.current_result = JSON.stringify(data,null,2);
          showErrorDialog("Error getting documents.",
              "Couldn't retrieve: " + dec.options.selected_bucket + " offset: " + dec.options.offset +
              " limit " + dec.options.limit + ', Error:' + dec.options.current_result,true);
        }

        dec.options.queryBusy = false;
      });

    }


    //
    // get a list of buckets from the server, either through N1QL or the REST API
    //

    function getBuckets() {
        return getBuckets_rest();
    }


    function getBuckets_rest() {

      // get the buckets from the REST API
      var promise = $http({
        url: "../pools/default/buckets/",
        method: "GET"
      }).then(function success(resp) {
        if (resp && resp.status == 200 && resp.data) {
          // get the bucket names
          dec.buckets.length = 0;
          dec.buckets_ephemeral = {};
          var default_seen = false;
          for (var i=0; i < resp.data.length; i++) if (resp.data[i]) {
            if (dec.rbac.cluster.bucket[resp.data[i].name].data.docs.read) // only include buckets we have access to
              dec.buckets.push(resp.data[i].name);

            if (resp.data[i].bucketType == "ephemeral") // must handle ephemeral buckets differently
              dec.buckets_ephemeral[resp.data[i].name] = true;

            if (resp.data[i].name == dec.options.selected_bucket)
              default_seen = true;
          }

          // if we didn't see the user-selected bucket, reset selected bucket to the first one
          if (!default_seen)
            if (dec.buckets.length > 0)
              dec.options.selected_bucket = dec.buckets[0];
            else
              dec.options.selected_bucket = "";
        }
        //console.log("Got buckets2: " + JSON.stringify(dec.buckets));

      },function error(resp) {
        var data = resp.data, status = resp.status;

        if (data && data.errors) {
          dec.options.current_result = JSON.stringify(data.errors);
          showErrorDialog("Error getting list of buckets.", dec.options.current_result,true);
        }
      });

      return(promise);
    }

    function handleBucketParam() {

      // if we get a bucket as a parameter, that overrides current defaults
      if (_.isString($stateParams.bucket) && $stateParams.bucket.length > 0 && $stateParams.bucket != dec.options.selected_bucket) {
        dec.options.selected_bucket = $stateParams.bucket;
        dec.options.where_clause = ''; // reset the where clause
        dec.options.offset = 0; // start off from the beginning
      }

      // if we got a param, or a saved user-selected value, select it and get the docs
      if (dec.options.selected_bucket && dec.options.selected_bucket.length > 0) {
        // if we don't have any buckets yet, get the bucket list first
        if (dec.buckets.length == 0)
          getBuckets().then(retrieveDocs_inner);
        else
          retrieveDocs_inner();
      }
    }

    //
    // if the user updates something, we like to refresh the results, unless
    // there are unsaved changes
    //

    function refreshUnlessUnsaved() {

      // if nothing else on screen is dirty, refresh
      if (!$('#somethingChangedInTheEditor')[0]) {
        retrieveDocs_inner();
      }
      // otherwise let the user know that updates are not yet visible
      else {
        showErrorDialog("Info",
            "Because you have unsaved document edits, some changes won't be shown until you retrieve docs.",true);
      }
    }

    //
    // when we activate, check with the query service to see if we have a query node. If
    // so, we can use n1ql, if not, use the regular mode.
    //

    function activate() {
      //getBuckets(); // for some reason this extra call is needed, otherwise the menu doesn't populate

      //console.log("Activating DocEditor, got buckets.")

      // see if we have access to a query service
      validateQueryService.getBucketsAndNodes(function() {
        //console.log("Query service callback, getting ready to handle bucket param: " + $stateParams.bucket);

        var promise = getBuckets();

        // wait until after the buckets are retrieved to set the bucket name, if it was passed to us
        if (promise)
          promise.then(handleBucketParam);
        else {
          handleBucketParam();
        }
      });

    }

    //
    // all done, return the controller
    //

    return dec;
  }


})();
