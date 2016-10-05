(function () {
  "use strict";

  angular
    .module('qwQuery', ["ui.router", "mnPluggableUiRegistry", "mnJquery",
                      'qwJsonTree',
                      'qwJsonTable',
                      'qwExplainViz',
                      'qwLongPress',
                      'mnPendingQueryKeeper',
                      'mnServersService',
                      'mnPoolDefault',
                      'mnPermissions',
                      'ui.ace',
                      'ui.bootstrap'])
    .config(function($stateProvider, mnPluggableUiRegistryProvider) {
      $stateProvider
      .state('app.admin.query', {
        abstract: true,
        url: '/query',
        controller: 'qwQueryController',
        templateUrl: '/_p/ui/query/query_toplevel.html'
      })
      .state('app.admin.query.monitoring', {
        url: '/monitoring',
        controller: 'qwQueryController',
        templateUrl: '/_p/ui/query/query_monitoring.html'
      })
      .state('app.admin.query.workbench', {
        url: '/workbench',
        controller: 'qwQueryController',
        templateUrl: '/_p/ui/query/query.html'
      })
      ;
      mnPluggableUiRegistryProvider.registerConfig({
        name: 'Query',
        state: 'app.admin.query.workbench',
        plugIn: 'adminTab',
        after: 'buckets'//,
        //ngShow: canQuery("rbac.cluster.admin.internal.all"
      });
    })
    .run(function(jQuery, $timeout, $http) {
    })

    // we can only work if we have a query node. This service checks for
    // a query node a reports back whether it is present.

    .factory('validateQueryService', function($http,mnServersService,mnPermissions) {
      var _valid = false;
      var _inProgress = true;
      var _validNodes = [];
      var _otherStatus;
      var _otherError;
      var _bucketList = [];
      var service = {
          inProgress: function()       {return _inProgress;},
          valid: function()            {return _valid;},
          validBuckets: function()     {return _bucketList;},
          otherNodes: function()       {return _validNodes;},
          otherStatus: function()      {return _otherStatus;},
          otherError: function()       {return _otherError;}
      }

      // see what buckets we have permission to access
      var perms = mnPermissions.export.cluster;
      if (perms && perms.bucket)
        _.forEach(perms.bucket,function(v,k) {
          if (v && v.data && (v.data.read || v.data.write)) {
            _bucketList.push(k);
          }
        });

      // we can only run on nodes that support our API
      var queryData = {statement: "select \"test\";"};
      $http.post("/_p/query/query/service",queryData)
      .success(function(data, status, headers, config) {
        _valid = true; _inProgress = false;

      })
      .error(function(data, status, headers, config) {
        _valid = false; _inProgress = false;

        // if we got a 404, there is no query service on this node.
        // let's go through the list of nodes
        // and see which ones have a query service

        if (status == 404) mnServersService.getNodes().then(function (resp) {
          var nodes = resp.allNodes;
          for (var i = 0; i < nodes.length; i++)
            if (_.contains(nodes[i].services,"n1ql"))
              _validNodes.push("http://" + nodes[i].hostname + "/ui/index.html#/query/workbench");
        });
        // some other error to show
        else {
          _otherStatus = status;
          _otherError = data;
        }
      });

      return service;
    });

  //
  // parse the RBAC data to see if we can query any buckets
  //

  function canQuery(perms) {
    var result = false;
    if (perms && perms.bucket) _.forEach(perms.bucket,function(k,v) {
      if (perms.bucket[k] && perms.bucket[k].data &&
          (perms.bucket[k].data.read || perms.bucket[k].data.write)) {
        console.log("Can query: " + k);
        result = true;
        return(false);
      }

    });
    return(result);
  }

  angular.module('mnAdmin').requires.push('qwQuery');
}());
