/**
 * Angular directive to convert JSON into HTML tree. Inspired by Brian Park's
 * MIT Licensed "angular-json-human.js" which turns JSON to HTML tables.
 *
 *  Extended for trees by Eben Haber at Couchbase.
 *
 *  This class takes a JS object or JSON string, and displays it as an HTML
 *  table. Generally, it expects an array of something. If it's an array of objects,
 *  then each row corresponds to one object, and the columns are the union of all
 *  fields of the objects. If an object doesn't have a field, that cell is blank.
 *
 *
 *  , which object members indented. This is similar to pretty-printing
 *  JSON, but is more compact (no braces or commas), and permits using colors
 *  to highlight field names vs. values, and one line from the next.
 *
 *  For usage, see the header to qw-json-table.
 */
/* global _, angular */
(function() {

  'use strict';
  angular.module('qwExplainViz', []).directive('qwExplainViz', function () {
    return {
      restrict: 'A',
      scope: { data: '=qwExplainViz' },
      template: '<div></div>',
      link: function (scope, element) {

        scope.$watch('data', function (data) {
          // start with an empty div, if we have data convert it to HTML
          var content = "<div>{}</div>";
          if (data) {
            //console.log("Got data: " + JSON.stringify(data));
            content = "";

            if (_.isString(data))
              content = '<p class="error">' + data + '</p>';
            else if (data.data_not_cached)
              content = '<p class="error">' + JSON.stringify(data) + '</p>';

            // summarize plan
            if (data.analysis) {
              content += "<div class='row items-top qw-explain-summary indent-1'>";
              content += "<div class='column'>";
              content += "<h5>Indexes</h5>";
//              content += "<li>Indexes used: <ul>";
              for (var f in data.analysis.indexes)
                if (f.indexOf("#primary") >= 0)
                  content += "<em class='cbui-plan-expensive'>" + f + "</em>&nbsp;&nbsp; ";
                else
                  content += "<em>" + f + "</em>&nbsp;&nbsp; ";
              content += "</div>";

              content += "<div class='column'>";
              content += "<h5>Buckets</h5>";
              for (var b in data.analysis.buckets)
                content += "<em>" + b + "</em>&nbsp;&nbsp; ";
              content += "</div>";

              content += "<div class='column'>";
              content += "<h5>Fields</h5>";
              for (var f in data.analysis.fields)
                content += "<em>" + f + "</em>&nbsp;&nbsp; ";
              content += "</div>";


              content += "<div class='column text-right nowrap'>";
              content += '<a onclick="$(\'.qw-explain-wrapper\').removeClass(\'qw_zoom_1\');$(\'.qw-explain-wrapper\').addClass(\'qw_zoom_2\');$(\'.qw-explain-wrapper\').scrollLeft(4000)"><span class="icon fa-search"></span></a>';
              content += '<a onclick="$(\'.qw-explain-wrapper\').addClass(\'qw_zoom_1\');$(\'.qw-explain-wrapper\').removeClass(\'qw_zoom_2\');$(\'.qw-explain-wrapper\').scrollLeft(4000)"><span class="icon fa-search fa-1-5x"></span></a>';
              content += '<a onclick="$(\'.qw-explain-wrapper\').removeClass(\'qw_zoom_1\');$(\'.qw-explain-wrapper\').removeClass(\'qw_zoom_2\');$(\'.qw-explain-wrapper\').scrollLeft(4000)"><span class="icon fa-search fa-2x"></span></a>';
              content += "</div>";

              content += "</div>";
            }

            // Tabular plan
            if (data.plan_nodes) {
              //content += "<br><h3>Query Operator Data Flows (bottom to top):</h3><br>";
              //content += '<div class="ajtd-root ajtd-type-array">' +
              //makeHTMLtable(data.plan_nodes,"") + "</div>";

              // graphical plan
              //
              // map the plan to a data structure, the walk the structure, turning it into
              //

              content += '<div class="qw-explain-wrapper min-width-zero"><div class="row qw-zoom-wrapper"><div class="qw-node-wrapper qw-sequence qw-first-node">';
              content += makeTreeFromPlanNodes(data.plan_nodes);
              content += '</div></div></div>';
              //console.log("Visual tree: " + makeTree(transformedPlan));
            }
          }

          // set our element to use this HTML
          element.html(content);
        });
      }
    };
  });

  //
  // recursively turn the tree of ops into a graphical tree
  //

  function makeTreeFromPlanNodes(plan,hasSuccessor) {
    var result = '';

    if (!plan)
      return("empty plan");

    var opName = (plan && plan.operator && plan.operator['#operator'])
      ? plan.operator['#operator'] : "unknown op";
    var opClass = "qw-node";

    // if we are at the end of the line, we need less padding
    if (!plan.predecessor && !plan.subsequence && !hasSuccessor)
     opClass += " qw-last-node";

    // how expensive are we?
    if (plan && plan.time_percent)
      if (plan.time_percent >= 20) opClass += " expensive-3";
      else if (plan.time_percent >= 5)  opClass += " expensive-2";
      else if (plan.time_percent >= 1)  opClass += " expensive-1";


    // we ignore operators of nodes with subsequences
    if (plan.subsequence)
      result += makeTreeFromPlanNodes(plan.subsequence,plan.predecessor);

    // if we have no predecessor, or we do and it's a single op, output our operator

/* TOOLTIP VERSION OF REALITY:
else if (!plan.predecessor || !_.isArray(plan.predecessor))
  result += '<a href="" class="info-popup" uib-tooltip="Tooltip text goes here...."><div class="' + opClass +'">'
  + getLabelForOperator(plan)
  + '</div></a>';
*/
    else if (!plan.predecessor || !_.isArray(plan.predecessor)) {
      result += getDivForNode(plan,opClass);
    }

    if (plan.predecessor)
     if (_.isArray(plan.predecessor)) {
        result += '</div><div class="row padding-0 qw-combi-wrapper">';
        result += getDivForNode(plan,"qw-node qw-combinor");
        //result += '<div class="qw-node qw-combinor">' + opName + "</div>";
        result += '<div class="qw-combinor-border"></div>';
        result += '<div class="qw-rows-wrapper">';

        for (var i = 0; i < plan.predecessor.length; i++) {
          result += '<div class="row padding-0"><div class="qw-sequence qw-node-wrapper"><div class="qw-arrow-tip"></div>';
          result += makeTreeFromPlanNodes(plan.predecessor[i],hasSuccessor);
          result += '</div></div>';
        }

        result += '</div>';
      }
      else
        result += makeTreeFromPlanNodes(plan.predecessor,hasSuccessor);

    return(result);
  }

  //
  // get the div for a node to represent a given operator
  //

  function getDivForNode(plan, opClass) {
    var result = '<div class="' + opClass + '" title="';
    if (plan.operator)
      result += JSON.stringify(plan.operator).replace(/"/g,'\'');
    else
      result += "unknown op";

    result += '">' + getLabelForOperator(plan) + '</div>';
    return(result);
  }

  //
  //
  //

  function getLabelForCell(entry) {
    if (!entry)
      return("");
    else if (_.isString(entry))
      return(entry);
    else if (entry.operator && entry.operator['#operator'])
      return(getLabelForOperator(entry));
    else
      return("");
  }

  //
  // given a node from a JSON plan, come up with an HTML label appropriate
  //

  function getLabelForOperator(node) {

    var label = "";

    // is it expensive?
    if (node.GetCostLevel() == 2)
      label = '<span class=" ">' + node.GetName() + '</span>';
    else
      label = node.GetName();

    // now add the details, if any
    var details = node.GetDetails();
    for (var i = 0; i < details.length; i++) {
      label += ' <span class="qw-field">' + details[i] + '</span>';
    }

    return(label);
  }

})();
