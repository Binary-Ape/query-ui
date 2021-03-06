(function() {

  angular.module('qwQuery').controller('qwQueryController', queryController);

  queryController.$inject = ['$rootScope', '$stateParams', '$uibModal', '$timeout', 'qwQueryService',
    'validateQueryService','mnPools','$scope','$interval','qwConstantsService', 'mnPoolDefault',
    'mnServersService', 'qwJsonCsvService'];

  function queryController ($rootScope, $stateParams, $uibModal, $timeout, qwQueryService,
      validateQueryService, mnPools, $scope, $interval, qwConstantsService, mnPoolDefault,
      mnServersService, qwJsonCsvService) {

    var qc = this;
    //console.log("Start controller at: " + new Date().toTimeString());

    //
    // current UI version number
    //

    qc.version = "1.0.9 (DP 9)";

    //
    // alot of state is provided by the qwQueryService
    //

    qc.buckets = qwQueryService.buckets;                // buckets on cluster
    qc.gettingBuckets = qwQueryService.gettingBuckets;  // busy retrieving?
    qc.updateBuckets = qwQueryService.updateBuckets;    // function to update
    qc.lastResult = qwQueryService.getResult(); // holds the current query and result
    //qc.limit = qwQueryService.limit;            // automatic result limiter
    qc.executingQuery = qwQueryService.executingQuery;
    qc.emptyQuery = function() {return(qwQueryService.getResult().query.length == 0);}
    qc.emptyResult = qwQueryService.emptyResult;

    // some functions for handling query history, going backward and forward

    qc.prev = prevResult;
    qc.next = nextResult;

    qc.hasNext = qwQueryService.hasNextResult;
    qc.hasPrev = qwQueryService.hasPrevResult;

    qc.canCreateBlankQuery = qwQueryService.canCreateBlankQuery;

    qc.getCurrentIndex = qwQueryService.getCurrentIndex;
    qc.clearHistory= qwQueryService.clearHistory;

    qc.historyMenu = edit_history;

    // variable and code for managing the choice of output format in different tabs

    qc.selectTab = selectTab;
    qc.isSelected = qwQueryService.isSelected;

    qc.status_success = qwQueryService.status_success;
    qc.status_fail = qwQueryService.status_fail;
    qc.qqs = qwQueryService;

    //
    // options for the two editors, query and result
    //

    qc.aceInputLoaded = aceInputLoaded;
    qc.aceInputChanged = aceInputChanged;
    qc.aceOutputLoaded = aceOutputLoaded;
    qc.aceOutputChanged = aceOutputChanged;
    qc.updateEditorSizes = updateEditorSizes;

    qc.acePlanLoaded = acePlanLoaded;
    qc.acePlanChanged = acePlanChanged;

    //
    // expand/collapse/hide/show the analysis pane
    //

    qc.analysisExpanded = false;
    qc.toggleAnalysisSize = toggleAnalysisSize;
    qc.analysisHidden = false;
    qc.toggleAnalysisHide = toggleAnalysisHide;

    //
    // functions for running queries and saving results
    //

    qc.query = query;
    qc.unified_save = unified_save;
    qc.options = options;

    qc.load_query = load_query;

    //
    // options for the two Ace editors, the input and the output
    //

    qc.aceInputOptions = {
        mode: 'n1ql',
        showGutter: true,
        onLoad: qc.aceInputLoaded,
        onChange: qc.aceInputChanged,
        $blockScrolling: Infinity
    };

    qc.aceOutputOptions = {
        mode: 'json',
        showGutter: true,
        useWrapMode: true,
        onLoad: qc.aceOutputLoaded,
        onChange: qc.aceOutputChanged,
        $blockScrolling: Infinity
    };

    qc.acePlanOptions = {
        mode: 'json',
        showGutter: true,
        useWrapMode: true,
        onLoad: qc.acePlanLoaded,
        onChange: qc.acePlanChanged,
        $blockScrolling: Infinity
    };

    //
    // Do we have a REST API to work with?
    //

    qc.validated = validateQueryService;
    qc.validNodes = [];

    //
    // error message when result is too large to display
    //

    qc.maxTableSize = 750000;
    qc.maxTreeSize = 750000;
    qc.maxAceSize = 10485760;
    qc.maxSizeMsgTable = {error: "The table view is slow with results sized > " + qc.maxTableSize + " bytes. Try using the JSON view or specifying a lower limit in your query."};
    qc.maxSizeMsgTree = {error: "The tree view is slow with results sized > " + qc.maxTreeSize + " bytes. Try using the JSON view or specifying a lower limit in your query."};
    qc.maxSizeMsgJSON = "{\"error\": \"The JSON view is slow with results sized > " + qc.maxAceSize + " bytes. Try specifying a lower limit in your query.\"}";

    qc.showBigDatasets = false;     // allow the user to override the limit on showing big datasets

    qc.dataTooBig = dataTooBig;
    qc.setShowBigData = setShowBigData;
    qc.getBigDataMessage = getBigDataMessage;

    qc.renderPage = function() {updateEditorSizes();};

    // should we have the extra explain tabs?

    qc.autoExplain = qwConstantsService.autoExplain;

    qc.showBucketAnalysis = qwConstantsService.showBucketAnalysis;

    qc.showOptions = qwConstantsService.showOptions;

    //
    // does the browser support file choosing?
    //

    qc.fileSupport = (window.File && window.FileReader && window.FileList && window.Blob);

    //
    // labels for bucket analysis pane
    qc.fullyQueryableBuckets = qwConstantsService.fullyQueryableBuckets;
    qc.queryOnIndexedBuckets = qwConstantsService.queryOnIndexedBuckets;
    qc.nonIndexedBuckets = qwConstantsService.nonIndexedBuckets;

    // are we enterprise?

    qc.isEnterprise = validateQueryService.isEnterprise;

    qc.copyResultAsCSV = function() {copyResultAsCSV();};

    //
    // call the activate method for initialization
    //

    activate();

    //
    // Is the data too big to display for the selected results pane?
    //

    function dataTooBig() {
      switch (qwQueryService.outputTab) {
      case 1: return(qc.lastResult.resultSize / qc.maxAceSize) > 1.1;
      //case 2: return(qc.lastResult.resultSize / qc.maxTableSize) > 1.1;
      case 3: return(qc.lastResult.resultSize / qc.maxTreeSize) > 1.1;
      }

    }

    //
    // get a string to describe why the dataset is large
    //

    function getBigDataMessage() {
      var fraction;
      switch (qwQueryService.outputTab) {
      case 1: fraction = qc.lastResult.resultSize / qc.maxAceSize; break;
      case 2: fraction = qc.lastResult.resultSize / qc.maxTableSize; break;
      case 3: fraction = qc.lastResult.resultSize / qc.maxTreeSize; break;
      }
      var timeEstimate = Math.round(fraction * 2.5);
      var timeUnits = "seconds";
      if (timeEstimate > 60) {
        timeEstimate = Math.round(timeEstimate/60);
        timeUnits = "minutes";
      }
      var message = "The current dataset, " + qc.lastResult.resultSize + " " +
        "bytes, is too large to display quickly.<br>Using a lower limit or a more " +
        "specific where clause in your query can reduce result size. Rendering " +
        "might freeze your browser for " + timeEstimate + " to " + timeEstimate*4 +
        " " + timeUnits + " or more. ";

      if (qwQueryService.outputTab != 1) {
        message += "The JSON view is about 10x faster. ";
      }

      return(message);
    }

    function setShowBigData(show)
    {
      qc.showBigDatasets = show;
      $timeout(swapEditorFocus,10);
    }

    //
    // change the tab selection
    //

    function selectTab(tabNum) {
      if (qc.isSelected(tabNum))
        return; // avoid noop

      qc.showBigDatasets = false;
      qwQueryService.selectTab(tabNum);
      // select focus after a delay to try and force update of the editor
      $timeout(swapEditorFocus,10);
    };

    //
    // we need to define a wrapper around qw_query_server.nextResult, because if the
    // user creates a new blank query, we need to refocus on it.
    //

    function nextResult() {
      qc.showBigDatasets = false;
      qwQueryService.nextResult();
      $timeout(swapEditorFocus,10);
    }

    function prevResult() {
      qc.showBigDatasets = false;
      qwQueryService.prevResult();
      $timeout(swapEditorFocus,10);
    }

    //
    // the text editor doesn't update visually if changed when off screen. Force
    // update by focusing on it
    //

    function swapEditorFocus() {
      if (qc.outputEditor) {
        qc.outputEditor.focus();
        qc.inputEditor.focus();
      }
      updateEditorSizes();
    }

    //
    // manage the ACE code editors for query input and JSON output
    //

    var endsWithSemi = /;\s*$/i;
    var matchNonQuotedSmartQuotes = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|([\u201C\u201D\u201E\u201F\u2033\u2036\u2018\u2019\u201A\u201B\u2032\u2035])/ig;

    function aceInputChanged(e) {
      //console.log("input changed, action: " + JSON.stringify(e[0]));
      //console.log("current text : " + JSON.stringify(qc.inputEditor.getSession().getValue()));
      //console.log("current query: " + qc.lastResult.query);

      //
      // only support auto-complete if we're in enterprise mode
      //

      if (qc.isEnterprise() && !qc.inputEditor.getOption("enableBasicAutocompletion")) {
        // make autocomplete work with 'tab', and auto-insert if 1 match
        autocomplete.Autocomplete.startCommand.bindKey = "Ctrl-Space|Ctrl-Shift-Space|Alt-Space|Tab";
        autocomplete.Autocomplete.startCommand.exec = autocomplete_exec;
        // enable autocomplete
        qc.inputEditor.setOptions({enableBasicAutocompletion: true});
        // add completer that works with path expressions with '.'
        langTools.setCompleters([identifierCompleter,langTools.keyWordCompleter]);
      }

     // weird bug - sometimes the query is not up to date with the text area
      if (qc.inputEditor.getSession().getValue() != qc.lastResult.query)
        qc.lastResult.query = qc.inputEditor.getSession().getValue();

      // show a placeholder when nothing has been typed
      var curSession = qc.inputEditor.getSession();
      var noText = curSession.getValue().length == 0;
      var emptyMessageNode = qc.inputEditor.renderer.emptyMessageNode;

      // when the input is changed, clear all the markers
      curSession.clearAnnotations();
      if (qc.markerIds) {
        for (var i=0; i< qc.markerIds.length; i++)
          curSession.removeMarker(qc.markerIds[i]);
        qc.markerIds.length = 0;
      }

      //console.log("Notext: " +noText + ", emptyMessageNode: " + emptyMessageNode);
      if (noText && !emptyMessageNode) {
        emptyMessageNode = qc.inputEditor.renderer.emptyMessageNode = document.createElement("div");
        emptyMessageNode.innerText = "Enter a query here.";
        emptyMessageNode.className = "ace_invisible ace_emptyMessage";
        emptyMessageNode.style.padding = "0 5px";
        qc.inputEditor.renderer.scroller.appendChild(emptyMessageNode);
      }
      else if (!noText && emptyMessageNode) {
        qc.inputEditor.renderer.scroller.removeChild(emptyMessageNode);
        qc.inputEditor.renderer.emptyMessageNode = null;
      }

      qc.inputEditor.$blockScrolling = Infinity;

      // for inserts, by default move the cursor to the end of the insert
      // and replace any smart quotes with dumb quotes

      if (e[0].action === 'insert') {

        // detect and remove smart quotes, but only outside existing quoted strings. The regex
        // pattern matches either quoted strings or smart quotes outside quoted strings. If we
        // see any matched  for group 1, a bare smart quote, replace it.
        var matchArray = matchNonQuotedSmartQuotes.exec(qc.lastResult.query);
        if (matchArray != null) {
          var newBytes = "";
          var curBytes = qc.lastResult.query;
          while (matchArray != null)  {
            if (matchArray[1]) { // we want group 1
              newBytes += curBytes.substring(0,matchNonQuotedSmartQuotes.lastIndex - 1) + '"';
              curBytes = curBytes.substring(matchNonQuotedSmartQuotes.lastIndex);
              matchNonQuotedSmartQuotes.lastIndex = 0;
            }
            matchArray = matchNonQuotedSmartQuotes.exec(curBytes);
          }

          if (newBytes.length > 0)
            qc.lastResult.query = newBytes + curBytes;
        }

        // after past grab focus, move to end

        updateEditorSizes();
        qc.inputEditor.moveCursorToPosition(e[0].end);
        qc.inputEditor.focus();

        // if they pasted more than one line, and we're at the end of the editor, trim
        var pos = qc.inputEditor.getCursorPosition();
        var line = qc.inputEditor.getSession().getLine(pos.row);
        if (e[0].lines && e[0].lines.length > 1 && e[0].lines[0].length > 0 &&
            pos.row == (qc.inputEditor.getSession().getLength()-1) &&
            pos.column == line.length)
          qc.lastResult.query = qc.lastResult.query.trim();

        // if they hit enter and the query ends with a semicolon, run the query
        if (qwConstantsService.autoExecuteQueryOnEnter && // auto execute enabled
            e[0].lines && e[0].lines.length == 2 && // <cr> marked by two empty lines
            e[0].lines[0].length == 0 &&
            e[0].lines[1].length == 0 &&
            e[0].start.column > 0 && // and the previous line wasn't blank
            curSession.getLine(e[0].start.row).trim()[curSession.getLine(e[0].start.row).trim().length -1] === ';' &&
            endsWithSemi.test(qc.lastResult.query))
          qc.query();
      }

    };

    //
    // initialize the query editor
    //

    var langTools = ace.require("ace/ext/language_tools");
    var autocomplete = ace.require("ace/autocomplete");

    function aceInputLoaded(_editor) {
      _editor.$blockScrolling = Infinity;
      _editor.setFontSize('13px');
      _editor.renderer.setPrintMarginColumn(false);
      _editor.setReadOnly(qc.executingQuery.busy);

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      qc.inputEditor = _editor;

      focusOnInput();

      //
      // make the query editor "catch" drag and drop files
      //

      $(".wb-ace-editor")[0].addEventListener('dragover',handleDragOver,false);
      $(".wb-ace-editor")[0].addEventListener('drop',handleFileDrop,false);
    };

    // this function is used for autocompletion of dynamically known names such
    // as bucket names, field names, and so on. We only want to return items that
    // either start with the prefix, or items where the prefix follows a '.'
    // (meaning that the prefix is a field name from a path)

    var identifierCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
          //console.log("Completing: *" + prefix + "*");

          var results = [];
          var modPrefix = '.' + prefix;
          var modPrefix2 = _.startsWith(prefix,'`') ? prefix : '`' + prefix;
          for (var i=0; i<qwQueryService.autoCompleteArray.length; i++) {
            //console.log("  *" + qwQueryService.autoCompleteArray[i].caption + "*");
            if (_.startsWith(qwQueryService.autoCompleteArray[i].caption,prefix) ||
                qwQueryService.autoCompleteArray[i].caption.indexOf(modPrefix) >= 0 ||
                qwQueryService.autoCompleteArray[i].caption.indexOf(modPrefix2) >= 0) {
              //console.log("    Got it, pushing: " + qwQueryService.autoCompleteArray[i]);
              results.push(qwQueryService.autoCompleteArray[i]);
            }
          }

          callback(null,results);
        },

        /*
         * We need to override the 'retrievePrecedingIdentifier' regex which treats path
         * expressions separated by periods as separate identifiers, when for the purpose
         * of autocompletion, we want to treat paths as a single identifier. We also need
         * to recognize backtick as part of an identifier.
         */

        identifierRegexps: [/[a-z\.`:A-Z_0-9\$\-\u00A2-\uFFFF]/]
    };

    //
    // for autocompletion, we want to override the 'exec' function so that autoInsert
    // is the default (i.e., if there is only one match, don't bother showing the menu).
    //

    var autocomplete_exec =  function(editor) {
      if (!editor.completer)
        editor.completer = new autocomplete.Autocomplete();
      editor.completer.autoInsert = true;
      editor.completer.autoSelect = true;
      editor.completer.showPopup(editor);
      editor.completer.cancelContextMenu();
    };

    //
    // We want to be able to handle a file drop on the query editor. Default behavior
    // is to change the browser to a view of that file, so we need to override that
    //

    function handleDragOver(evt) {
      evt.stopPropagation();
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'copy';
    }

    //
    // When they drop the file, take the contents and put in the
    //
    function handleFileSelect() {
      loadQueryFileList(this.files);
    }


    function handleFileDrop(evt) {
      evt.stopPropagation();
      evt.preventDefault();

      var files = evt.dataTransfer.files; // FileList object.
      loadQueryFileList(files);
    }

    function loadQueryFileList(files) {
      // make sure we have a file
      if (files.length == 0)
        return;

      // make sure the file ends in .txt or .n1ql
      var file = files.item(0);
      if (!file.name.toLowerCase().endsWith(".n1ql") && !file.name.toLowerCase().endsWith(".txt")) {
        showErrorMessage("Can't load: " + file.name + ".\nQuery import only supports files ending in '.txt'")
        return;
      }

      // files is a FileList of File objects. load the first one into the editor, if any.
      var reader = new FileReader();
      reader.addEventListener("loadend",function() {addNewQueryContents(reader.result);});
      reader.readAsText(files[0]);
    }

    // when they click the Load Query button

    function load_query() {
      $("#loadQuery")[0].value = null;
      $("#loadQuery")[0].addEventListener('change',handleFileSelect,false);
      $("#loadQuery")[0].click();
    }

    // bring the contents of a file into the query editor and history

    function addNewQueryContents(contents) {
      // move to the end of history
      qwQueryService.addNewQueryAtEndOfHistory(contents);
      qc.inputEditor.getSession().setValue(contents);
    }

    //
    // Initialize the output ACE editor
    //

    function aceOutputLoaded(_editor) {
      //console.log("AceOutputLoaded");
      _editor.$blockScrolling = Infinity;
      _editor.setReadOnly(true);
      _editor.renderer.setPrintMarginColumn(false); // hide page boundary lines

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      qc.outputEditor = _editor;
      updateEditorSizes();
    };

    function aceOutputChanged(e) {
      updateEditorSizes();

      // show a placeholder when nothing has been typed
      var curSession = qc.outputEditor.getSession();
      var noText = curSession.getValue().length == 0;
      var emptyMessageNode = qc.outputEditor.renderer.emptyMessageNode;

      //console.log("Notext: " +noText + ", emptyMessageNode: " + emptyMessageNode);
      if (noText && !emptyMessageNode) {
        emptyMessageNode = qc.outputEditor.renderer.emptyMessageNode = document.createElement("div");
        emptyMessageNode.innerText =
          'See JSON, Table, and Tree formatted query results here.\n'+
          'Hover over field names (in the tree layout) to see their full path.';
        emptyMessageNode.className = "ace_invisible ace_emptyMessage";
        emptyMessageNode.style.padding = "0 5px";
        qc.outputEditor.renderer.scroller.appendChild(emptyMessageNode);
      }
      else if (!noText && emptyMessageNode) {
        qc.outputEditor.renderer.scroller.removeChild(emptyMessageNode);
        qc.outputEditor.renderer.emptyMessageNode = null;
      }

    }

    function acePlanLoaded(_editor) {
      //console.log("AcePlanLoaded");
      _editor.$blockScrolling = Infinity;
      _editor.setReadOnly(true);
      _editor.renderer.setPrintMarginColumn(false); // hide page boundary lines

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      //qc.outputEditor = _editor;
      updateEditorSizes();
    }

    function acePlanChanged(e) {
      //e.$blockScrolling = Infinity;

      updateEditorSizes();
    }
    //
    // called when the JSON output changes. We need to make sure the editor is the correct size,
    // since it doesn't auto-resize
    //

    function updateEditorSizes() {
      var margins = 90;
      var windowHeight = window.innerHeight;
      var pageFooterHeight = 96;
      var headerNavHeight = 47;
      var queryBoxHeight = $('.wb-query-editor').height();
      //var sidebarHeaderHeight =  $('#sidebar_header').height();

      var otherStuff = pageFooterHeight + headerNavHeight + queryBoxHeight;

      if (headerNavHeight == null || queryBoxHeight == null) {
        return;
      }

      var editor_size = windowHeight - otherStuff - margins;
      if (editor_size > 1000)
        editor_size = 1150;
      if (editor_size < 0)
        editor_size = 0;

//    console.log("pageHeaderHeight: " + pageHeaderHeight);
//    console.log("pageFooterHeight: " + pageFooterHeight);
//    console.log("headerNavHeight: " + headerNavHeight);
//    console.log("queryBoxHeight: " + queryBoxHeight);
//      console.log("windowHeight: " + windowHeight);
//      console.log("resultHeaderHeight: " + resultHeaderHeight);
//      console.log("resultSummaryHeight: " + resultSummaryHeight + "\n\n");
//      console.log(" editor_size: " + editor_size);

      var sidebarHeight = windowHeight - pageFooterHeight - 40;

      $('.insights-sidebar').height(sidebarHeight);
      $('.wb-results-json').height(editor_size);
      $('.wb-results-table').height(editor_size + 32);
      $('.wb-results-tree').height(editor_size + 15);
      $('.wb-results-explain').height(editor_size + 32);
      $('.wb-results-explain-text').height(editor_size + 32);

      // allow the query editor to grow and shrink a certain amount based
      // on the number of lines in the query
      //
      // as the query is edited, allow it more vertical space, but make sure it
      // doesn't have fewer than 5 lines or more than ~50% of the window

      if (qc.inputEditor) {
        var queryAreaHeight = Math.max($('.wb-main-wrapper').height(),240);
        var queryHeaderHeight = $('.wb-query-editor-header').height();
        var curSession = qc.inputEditor.getSession();
        var lines = curSession.getLength();
        var halfScreen = queryAreaHeight/2-queryHeaderHeight*4;
        var height = Math.max(75,((lines-1)*21)-10); // make sure height no less than 75
        if (halfScreen > 75 && height > halfScreen)
          height = halfScreen;

        //console.log("QueryAreaHeight: " + queryAreaHeight + ", queryHeaderHeight: " + queryHeaderHeight);
        //console.log("Half screen: " + halfScreen + ", Area height: " + queryAreaHeight + ", header: " + queryHeaderHeight + ", setting height to: " + height);

        $(".wb-ace-editor").height(height);
      }

    }

    $(window).resize(updateEditorSizes);

    //
    // make the focus go to the input field, so that backspace doesn't trigger
    // the browser back button
    //

    function focusOnInput()  {
      if (qc.inputEditor && qc.inputEditor.focus)
        qc.inputEditor.focus();
    }

    //
    // functions for running queries and saving results to a file
    //

    function query(explainOnly) {
      // make sure there is a query to run
      if (qc.lastResult.query.trim().length == 0)
        return;

      // if a query is already running, we should cancel it
      if (qc.executingQuery.busy) {
        qwQueryService.cancelQuery();
        return;
      }

      // don't let the user edit the query while it's running
      qc.inputEditor.setReadOnly(true);

      // remove trailing whitespace to keep query from growing, and avoid
      // syntax errors (query parser doesn't like \n after ;
      if (endsWithSemi.test(qc.lastResult.query))
        qc.lastResult.query = qc.lastResult.query.trim();

      var queryStr = qc.lastResult.query;

      //console.log("Running query: " + queryStr);
      // run the query and show a spinner

      var promise = qwQueryService.executeQuery(queryStr,qc.lastResult.query,qwQueryService.options,explainOnly);

      if (promise) {
        // also have the input grab focus at the end
        promise.then(doneWithQuery,doneWithQuery);
      }
      else
        doneWithQuery();
    };

    //
    // when a query finishes, we need to re-enable the query field, and try and put
    // the focus there
    //
    var aceRange = ace.require('ace/range').Range;

    function doneWithQuery() {
      // if there are possibly bad fields in the query, mark them
      var annotations = [];
      var markers = [];
      var markerIds = [];
      var session = qc.inputEditor.getSession();

      //console.log("Explain result: " + JSON.stringify(qc.lastResult.explainResult));
      //console.log("Explain result probs: " + JSON.stringify(qc.lastResult.explainResult.problem_fields));

      if (qc.lastResult && qc.lastResult.explainResult && qc.lastResult.explainResult.problem_fields &&
          qc.lastResult.explainResult.problem_fields.length > 0) {
        var lines = session.getLines(0,session.getLength()-1);
        var fields = qc.lastResult.explainResult.problem_fields;

        var allFields = "";
        var field_names = [];

        for (var i=0;i<fields.length;i++) {
          allFields += " " + fields[i].bucket + "." + fields[i].field.replace(/\[0\]/gi,"[]") + "\n";
          // find the final name in the field path, extracting any array expr
          var field = fields[i].field.replace(/\[0\]/gi,"");
          var lastDot = field.lastIndexOf(".");
          if (lastDot > -1)
            field = field.substring(lastDot);
          field_names.push(field);
        }

        // one generic warning for all unknown fields
        annotations.push(
            {row: 0,column: 0,
            text: "This query contains the following fields not found in the inferred schema for their bucket,\nthe field names might be misspelled: \n"+ allFields,
            type: "warning"});

        // for each line, for each problem field, find all matches and add an info annotation
        for (var l=0; l < lines.length; l++)
          for (var f=0; f < field_names.length; f++) {
            var startFrom = 0;
            var curIdx = -1;
            while ((curIdx = lines[l].indexOf(field_names[f],startFrom)) > -1) {
              markers.push({start_row: l, end_row: l, start_col: curIdx, end_col: curIdx + field_names[f].length});
              startFrom = curIdx + 1;
            }
          }
      }

      for (var i=0; i<markers.length; i++)
        markerIds.push(session.addMarker(new aceRange(markers[i].start_row,markers[i].start_col,
                                    markers[i].end_row,markers[i].end_col),
                          "ace_selection","text"));

      if (annotations.length > 0)
        session.setAnnotations(annotations);
      else
        session.clearAnnotations();

      // now update everything
      qc.inputEditor.setReadOnly(false);
      qc.markerIds = markerIds;
      updateEditorSizes();
      focusOnInput();
    }

    //
    // save the results to a file. Here we need to use a scope to to send the file name
    // to the file name dialog and get it back again.
    //

    var dialogScope = $rootScope.$new(true);

    // default names for save and save_query
    dialogScope.data_file = {name: "data.json"};
    dialogScope.query_file = {name: "n1ql_query.txt"};
    dialogScope.file = {name: "output"};

    function options() {
      dialogScope.options = qwQueryService.clone_options();
      dialogScope.options.positional_parameters = [];
      dialogScope.options.named_parameters = [];

      // the named & positional parameters are values, convert to JSON
      if (qwQueryService.options.positional_parameters)
        for (var i=0; i < qwQueryService.options.positional_parameters.length; i++)
          dialogScope.options.positional_parameters[i] =
            JSON.stringify(qwQueryService.options.positional_parameters[i]);

      if (qwQueryService.options.named_parameters)
        for (var i=0; i < qwQueryService.options.named_parameters.length; i++) {
          dialogScope.options.named_parameters.push({
            name: qwQueryService.options.named_parameters[i].name,
            value: JSON.stringify(qwQueryService.options.named_parameters[i].value)
          });
        }

      // bring up the dialog
      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/prefs_dialog/qw_prefs_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        // any named or positional parameters are entered as JSON, and must be parsed into
        // actual values
        if (dialogScope.options.positional_parameters)
          for (var i=0; i < dialogScope.options.positional_parameters.length; i++)
            dialogScope.options.positional_parameters[i] =
              JSON.parse(dialogScope.options.positional_parameters[i]);

        if (dialogScope.options.named_parameters)
          for (var i=0; i < dialogScope.options.named_parameters.length; i++)
            dialogScope.options.named_parameters[i].value =
              JSON.parse(dialogScope.options.named_parameters[i].value);

        qwQueryService.options = dialogScope.options;
        qwQueryService.saveStateToStorage();
      });

    }

    //
    // going forward we will have a single file dialog that allows the user to select
    // "Results" or "Query"
    //

    function unified_save() {
      dialogScope.safari = /^((?!chrome).)*safari/i.test(navigator.userAgent);

      // but for those that do, get a name for the file
      dialogScope.file_type = 'query';
      dialogScope.file = dialogScope.file;
      dialogScope.file_options = [
        {kind: "json", label: "Query Results"},
        {kind: "txt", label: "Results as tab-separated"},
        ];
      if (qc.lastResult.query && qc.lastResult.query.length > 0)
        dialogScope.file_options.push({kind: "txt", label: "Query Statement"});
      dialogScope.selected = {item: "0"};

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/file_dialog/qw_query_unified_file_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        var file;
        var file_extension;

        switch (dialogScope.selected.item) {
        case "0":
          file = new Blob([qc.lastResult.result],{type: "text/json", name: "data.json"});
          file_extension = ".json";
          break;

        case "1":
          var csv = qwJsonCsvService.convertDocArrayToTSV(qc.lastResult.data);
          if (!csv || csv.length == 0) {
            showErrorMessage("Unable to create tab-separated values, perhaps source data is not an array.");
            return;
          }
          file = new Blob([csv],{type: "text/plain", name: "data.txt"});
          file_extension = ".txt";
          break;

        case "2":
          file = new Blob([qc.lastResult.query],{type: "text/plain", name: "query.txt"});
          file_extension = ".txt";
          break;

        default:
          console.log("Error saving content, no match, selected item: " + dialogScope.selected.item);
          break;
        }

        saveAs(file,dialogScope.file.name + file_extension);
      });

    }

    //
    // save the current query to a file. Here we need to use a scope to to send the file name
    // to the file name dialog and get it back again.
    //

    function edit_history() {

      // history dialog needs a pointer to the query service
      dialogScope.pastQueries = qwQueryService.getPastQueries();
      dialogScope.selected = [];
      dialogScope.selected[qwQueryService.getCurrentIndexNumber()] = true;
      dialogScope.select = function(index,keyEvent) {
        // with no modifiers, create a new selection where they clicked
        //console.log("Got select, event: " + " alt: " + keyEvent.altKey + ", ctrl: " + keyEvent.ctrlKey + ", shift: " + keyEvent.shiftKey);
        if (!keyEvent.shiftKey) {
          for (var i=0; i < qwQueryService.getPastQueries().length; i++)
            dialogScope.selected[i] = false;
          qwQueryService.setCurrentIndex(index);
          dialogScope.selected[index] = true;
        }
        // otherwise select the range from the clicked row to the selected row, and make the first one
        // the "current"
        else {
          var alreadySelected = dialogScope.selected[index];
          var start = Math.min(index,qwQueryService.getCurrentIndexNumber());
          var end = Math.max(index,qwQueryService.getCurrentIndexNumber());
          for (var i=start; i <= end; i++)
            dialogScope.selected[i] = true;
          // unselect any additional queries
          if (alreadySelected) // if they within the existing the selection, shorten it
            for (var i=end+1; i< qwQueryService.getPastQueries().length; i++)
              dialogScope.selected[i] = false;
          qwQueryService.setCurrentIndex(start);
        }
      };
      dialogScope.isRowSelected = function(row) {return(dialogScope.selected[row]);};
      dialogScope.isRowMatched = function(row) {return(_.indexOf(historySearchResults,row) > -1);};
      dialogScope.showRow = function(row) {return(historySearchResults.length == 0 || dialogScope.isRowMatched(row));};
      dialogScope.del = function() {
        var origHistoryLen = qwQueryService.getPastQueries().length;
        // delete all selected, visible queries
        for (var i= qwQueryService.getPastQueries().length - 1; i >= 0; i--)
          if (dialogScope.showRow(i) && dialogScope.isRowSelected(i))
            qwQueryService.clearCurrentQuery(i);
        // forget any previous selection
        for (var i=0; i < origHistoryLen; i++)
          dialogScope.selected[i] = false;
        //console.log("after delete, selecting: " + qwQueryService.getCurrentIndexNumber());

        if (qwQueryService.getCurrentIndexNumber() >= 0)
          dialogScope.selected[qwQueryService.getCurrentIndexNumber()] = true;

        updateSearchResults();
      };
      // disable delete button if search results don't include any selected query
      dialogScope.disableDel = function() {
        // can always delete if no search text, or no matching queries
        if (searchInfo.searchText.length == 0 || historySearchResults.length == 0)
          return false;
        // if search text, see if any matching rows are selected
        for (var i= qwQueryService.getCurrentIndexNumber(); i < qwQueryService.getPastQueries().length - 1; i++)
          if (dialogScope.isRowMatched(i) && dialogScope.isRowSelected(i))
            return(false);
          // if we are past the selection, no need to check anything else
          else if (!dialogScope.isRowSelected(i))
            break;
        // no selected items visible, return true
        return(true);
        };
      dialogScope.delAll = function(close) {
        var innerScope = $rootScope.$new(true);
        innerScope.error_title = "Delete All History";
        innerScope.error_detail = "Warning, this will delete the entire query history.";
        innerScope.showCancel = true;

        var promise = $uibModal.open({
          templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_error_dialog.html',
          scope: innerScope
        }).result;

        promise.then(
            function success() {dialogScope.selected = []; qwQueryService.clearHistory(); close('ok');});

      };
      dialogScope.searchInfo = searchInfo;
      dialogScope.updateSearchResults = updateSearchResults;
      dialogScope.selectNextMatch = selectNextMatch;
      dialogScope.selectPrevMatch = selectPrevMatch;

      var subdirectory = '/ui-current';

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory +
                     '/history_dialog/qw_history_dialog.html',
        scope: dialogScope
      }).result;

      promise.then(function(result) {
        if (result === 'run')
          query(false);
      });

      // scroll the dialog's table
      $timeout(scrollHistoryToSelected,100);

    };

    var historySearchResults = [];
    var searchInfo = {searchText: "", searchLabel: "search:"};

    function scrollHistoryToSelected() {
      var label = "qw_history_table_"+qwQueryService.getCurrentIndexNumber();
      var elem = document.getElementById(label);
      if (elem)
        elem.scrollIntoView();
      window.scrollTo(0,0);
    }

    function updateSearchLabel() {
      if (searchInfo.searchText.trim().length == 0)
        searchInfo.searchLabel = "search:";
      else
        searchInfo.searchLabel = historySearchResults.length + " matches";
    }

    function updateSearchResults() {
      var history = qwQueryService.getPastQueries();
      // reset the history
      var searchText = searchInfo.searchText.toLowerCase();
      historySearchResults.length = 0;
      if (searchInfo.searchText.trim().length > 0)
        for (var i=0; i<history.length; i++) {
          //console.log("  comparing to: " + history[i].query)
          if (history[i].query.toLowerCase().indexOf(searchText) > -1)
            historySearchResults.push(i);
        }

      updateSearchLabel();

      if (historySearchResults.length == 0)
        scrollHistoryToSelected();
    }

    // get the next/previous query matching the search results

    function selectNextMatch() {
      var curMatch = qwQueryService.getCurrentIndexNumber();

      // nothing to do if no search results
      if (historySearchResults.length == 0)
        return;

      // need to find the value in the history array larger than the current selection, or wrap around
      for (var i=0; i < historySearchResults.length; i++)
        if (historySearchResults[i] > curMatch) {
          qwQueryService.setCurrentIndex(historySearchResults[i]);
          scrollHistoryToSelected();
          return;
        }

      // if we get this far, wrap around to the beginning
      qwQueryService.setCurrentIndex(historySearchResults[0]);
      scrollHistoryToSelected();
    }

    function selectPrevMatch() {
      var curMatch = qwQueryService.getCurrentIndexNumber();

      // nothing to do if no search results
      if (historySearchResults.length == 0)
        return;

      // need to find the last value in the history array smaller than the current selection, or wrap around
      for (var i=historySearchResults.length-1;i>=0; i--)
        if (historySearchResults[i] < curMatch) {
          qwQueryService.setCurrentIndex(historySearchResults[i]);
          scrollHistoryToSelected();
          return;
        }

      // if we get this far, wrap around to the beginning
      qwQueryService.setCurrentIndex(historySearchResults[historySearchResults.length-1]);
      scrollHistoryToSelected();
    }

     //
    // toggle the size of the bucket insights pane
    //

    function toggleAnalysisSize() {
      if (!qc.analysisExpanded) {
        $(".insights-sidebar").removeClass("width-3");
        $(".insights-sidebar").addClass("width-6");
        $(".wb-main-wrapper").removeClass("width-9");
        $(".wb-main-wrapper").addClass("width-6")
      }
      else {
        $(".insights-sidebar").removeClass("width-6");
        $(".insights-sidebar").addClass("width-3");
        $(".wb-main-wrapper").removeClass("width-6");
        $(".wb-main-wrapper").addClass("width-9");
      }
      qc.analysisExpanded = !qc.analysisExpanded;
    }
    //
   // hide & show the bucket insights pane
   //

   function toggleAnalysisHide() {
     if (!qc.analysisHidden) {
       $(".insights-sidebar").removeClass("width-3");
       $(".insights-sidebar").addClass("fix-width-0");
       $(".wb-main-wrapper").removeClass("width-9");
       $(".wb-main-wrapper").addClass("width-12")
     }
     else {
       $(".insights-sidebar").removeClass("fix-width-0");
       $(".insights-sidebar").addClass("width-3");
       $(".wb-main-wrapper").removeClass("width-12");
       $(".wb-main-wrapper").addClass("width-9");
     }
     qc.analysisHidden = !qc.analysisHidden;
   }

    //
    // show an error dialog
    //

    function showErrorMessage(message) {
      dialogScope.error_title = "Error";
      dialogScope.error_detail = message;

      $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_error_dialog.html',
        scope: dialogScope
      });
    }

    //
    // when the cluster nodes change, test to see if it's a significant change. if so,
    // update the list of nodes.
    //

    var prev_active_nodes = null;

    function nodeListsEqual(one, other) {
      if (!_.isArray(one) || !_.isArray(other))
        return(false);

      if (one.length != other.length)
        return(false);

      for (var i=0; i<one.length; i++) {
        if (!(_.isEqual(one[i].clusterMembership,other[i].clusterMembership) &&
            _.isEqual(one[i].hostname,other[i].hostname) &&
            _.isEqual(one[i].services,other[i].services) &&
            _.isEqual(one[i].status,other[i].status)))
          return false;
      }
      return(true);
    }


    //
    // get the latest valid nodes for query
    //

    function updateValidNodes() {
      var pool = mnPoolDefault.latestValue();
      if (pool.value && pool.value.nodes)
          qc.validNodes = mnPoolDefault.getUrlsRunningService(mnPoolDefault.latestValue().value.nodes, "n1ql", null);
      else
          qc.validNodes = [];
    }


    function copyResultAsCSV() {
      var csv = qwJsonCsvService.convertDocArrayToTSV(qc.lastResult.data);

      // error check
      if (!csv || csv.length == 0) {
        showErrorMessage("Unable to create tab-separated values, perhaps source data is not an array.");
        return;
      }

      // create temp element
      var copyElement = document.createElement("textarea");
      angular.element(document.body.append(copyElement));
      copyElement.value = csv;
      copyElement.focus();
      copyElement.select();
      document.execCommand('copy');
      copyElement.remove();
    }

    //
    // let's start off with a list of the buckets
    //

    function activate() {
      //
      // make sure we stay on top of the latest query nodes
      //

      updateValidNodes();

      $rootScope.$on("nodesChanged", function () {
        mnServersService.getNodes().then(function(nodes) {
          if (prev_active_nodes && !nodeListsEqual(prev_active_nodes,nodes.active)) {
            updateValidNodes();
          }
          prev_active_nodes = nodes.active;
        });
       });

      // if we receive a query parameter, and it's not the same as the current query,
      // insert it at the end of history
      if (_.isString($stateParams.query) && $stateParams.query.length > 0 &&
          $stateParams.query != qc.lastResult.query) {
        qwQueryService.addNewQueryAtEndOfHistory($stateParams.query);
      }

      // Prevent the backspace key from navigating back. Thanks StackOverflow!
      $(document).unbind('keydown').bind('keydown', function (event) {
        var doPrevent = false;
        if (event.keyCode === 8) {
          var d = event.srcElement || event.target;
          if ((d.tagName.toUpperCase() === 'INPUT' &&
              (
                  d.type.toUpperCase() === 'TEXT' ||
                  d.type.toUpperCase() === 'PASSWORD' ||
                  d.type.toUpperCase() === 'FILE' ||
                  d.type.toUpperCase() === 'SEARCH' ||
                  d.type.toUpperCase() === 'EMAIL' ||
                  d.type.toUpperCase() === 'NUMBER' ||
                  d.type.toUpperCase() === 'DATE' )
          ) ||
          d.tagName.toUpperCase() === 'TEXTAREA') {
            doPrevent = d.readOnly || d.disabled;
          }
          else {
            doPrevent = true;
          }
        }

        if (doPrevent) {
          event.preventDefault();
        }
      });

      //
      // check bucket counts every 5 seconds
      //

      if (!qwQueryService.pollSizes) {
        qwQueryService.pollSizes = $interval(function () {
        $rootScope.$broadcast("checkBucketCounts");
      }, 5000);

      $scope.$on('$destroy', function () {
        $interval.cancel(qwQueryService.pollSizes);
        qwQueryService.pollSizes = null;
      });
      }

      // get the list of buckets
      //qc.updateBuckets();

      //$( "#resizable-2" ).resizable({
      //  animate: true
    // });
      //$(".resizable").resizable({handles: "w"});

      //
      // now let's make sure the window is the right size
      //

      $timeout(updateEditorSizes,100);
    }

  }


})();
