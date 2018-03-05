(function() {

  // some globals used by both the highlighter and the autocompleter
  var keywords = (
      "and|any|apply|as|asc|at|autogenerated|between|btree|bucket|by|case|closed|create|compaction|compact|connect|connected|correlate|dataset|collection|dataverse|declare|definition|declare|definition|delete|desc|disconnect|distinct|drop|element|element|explain|else|enforced|end|every|except|exist|exists|external|feed|filter|flatten|for|from|full|function|group|having|hints|if|into|in|index|ingestion|inner|insert|internal|intersect|is|join|keyword|left|letting|let|like|limit|load|nodegroup|ngram|not|offset|on|open|or|order|outer|output|path|policy|pre-sorted|primary|raw|refresh|return|rtree|run|satisfies|secondary|select|set|shadow|some|temporary|then|type|unknown|unnest|update|use|using|value|when|where|with|write"
  );
  var keywords_array = keywords.split('|');

  var builtinConstants = (
      "true|false|datasetname|dataversename"
  );
  var builtinConstants_array = builtinConstants.split('|');

  var builtinFunctions = (
      ""
  );
  var builtinFunctions_array = builtinFunctions.split('|');

  var dataTypes = (
      ""
  );
  var dataTypes_array = dataTypes.split('|');

  define("ace/mode/sql_plus_plus_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"],
      function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var SqlPlusPlusHighlightRules = function() {

      var keywordMapper = this.createKeywordMapper({
        "support.function": builtinFunctions,
        "keyword": keywords,
        "constant.language": builtinConstants,
        "storage.type": dataTypes
      }, "identifier", true);

      this.$rules = {
          "start" : [ {
            token : "comment",
            regex : "--.*$"
          },  {
            token : "comment",
            start : "/\\*",
            end : "\\*/"
          }, {
            token : "constant.numeric",   // " string, make blue like numbers
            regex : '".*?"'
          }, {
            token : "constant.numeric",   // ' string, make blue like numbers
            regex : "'.*?'"
          }, {
            token : "identifier",         // ` quoted identifier, make like identifiers
            regex : "[`](([`][`])|[^`])+[`]"
          }, {
            token : "constant.numeric",   // float
            regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
          }, {
            token : keywordMapper,
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
          }, {
            token : "keyword.operator",
            regex : "\\+|\\-|\\/|\\/\\/|%|<@>|@>|<@|&|\\^|~|<|>|<=|=>|==|!=|<>|="
          }, {
            token : "paren.lparen",
            regex : "[\\(]"
          }, {
            token : "paren.rparen",
            regex : "[\\)]"
          }, {
            token : "text",
            regex : "\\s+"
          } ]
      };
      this.normalizeRules();
    };

    oop.inherits(SqlPlusPlusHighlightRules, TextHighlightRules);

    exports.SqlPlusPlusHighlightRules = SqlPlusPlusHighlightRules;
  });


  /*
   * We need to override the 'retrievePrecedingIdentifier' which treats path
   * expressions separated by periods as separate identifiers, when for the purpose
   * of autocompletion, we want to treat paths as a single identifier.
   */

  var util = require("ace/autocomplete/util");
  var ID_REGEX = /[a-z\.:A-Z_0-9\$\-\u00A2-\uFFFF]/;

  util.retrievePrecedingIdentifier = function(text, pos, regex) {
    regex = regex || ID_REGEX;
    var buf = [];
    for (var i = pos-1; i >= 0; i--) {
      if (regex.test(text[i]))
        buf.push(text[i]);
      else
        break;
    }

    return buf.reverse().join("");
  };


  /*
   * Define the SQL++ mode
   */

  define("ace/mode/sql_plus_plus_completions",["require","exports","module","ace/token_iterator"], function(require, exports, module) {
    "use strict";

    var TokenIterator = require("../token_iterator").TokenIterator;


    function is(token, type) {
      return token.type.lastIndexOf(type + ".xml") > -1;
    }

    function findTagName(session, pos) {
      var iterator = new TokenIterator(session, pos.row, pos.column);
      var token = iterator.getCurrentToken();
      while (token && !is(token, "tag-name")){
        token = iterator.stepBackward();
      }
      if (token)
        return token.value;
    }

    var SqlPlusPlusCompletions = function() {
    };

    (function() {

      this.getCompletions = function(state, session, pos, prefix) {
        var token = session.getTokenAt(pos.row, pos.column);

        // return only matching keywords, constants, or datatypes
        var results = [];

        for (var i=0; i<keywords_array.length; i++)
          if (_.startsWith(keywords_array[i],prefix))
            results.push({value: keywords_array[i], meta: 'keyword', score: 1});

        for (var i=0; i<builtinConstants_array.length; i++)
          if (_.startsWith(builtinConstants_array[i],prefix))
            results.push({value: builtinConstants_array[i], meta: 'built-in', score: 1});

        for (var i=0; i<builtinFunctions_array.length; i++)
          if (_.startsWith(builtinFunctions_array[i],prefix))
            results.push({value: builtinFunctions_array[i], meta: 'function', score: 1});

        for (var i=0; i<dataTypes_array.length; i++)
          if (_.startsWith(dataTypes_array[i],prefix))
            results.push({value: dataTypes_array[i], meta: 'datatype', score: 1});

        return results;
      };


    }).call(SqlPlusPlusCompletions.prototype);

    exports.SqlPlusPlusCompletions = SqlPlusPlusCompletions;
  });

  define("ace/mode/sql-plus-plus",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/sql_plus_plus_highlight_rules","ace/range"],
      function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var SqlPlusPlusHighlightRules = require("./sql_plus_plus_highlight_rules").SqlPlusPlusHighlightRules;
    var SqlPlusPlusCompletions = require("./sql_plus_plus_completions").SqlPlusPlusCompletions;
    var Range = require("../range").Range;

    var Mode = function() {
      this.HighlightRules = SqlPlusPlusHighlightRules;
      this.$completer = new SqlPlusPlusCompletions();
    };
    oop.inherits(Mode, TextMode);

    (function() {

      this.lineCommentStart = "--";

      this.getCompletions = function(state, session, pos, prefix) {
        return this.$completer.getCompletions(state, session, pos, prefix);
      };

      this.$id = "ace/mode/sql_plus_plus";
    }).call(Mode.prototype);

    exports.Mode = Mode;

  });

})();

