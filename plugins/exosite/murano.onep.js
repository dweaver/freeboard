/* Murano API client library
 
 Example usage:
  // instantiate Murano library
  var murano = new Murano({
    api_url: API_URL,
    websocket_url: WEBSOCKET_URL,
    error: function(code, options) {
      // handle general errors here
      if (code === murano.ERROR_CODES.BAD_TOKEN) {
        redirect_login();
      } else {
        console.log('UNKNOWN MURANO ERROR', code);
      }
    }
  });
  // get a API token for this browser session
  murano.init(function(err) {
    if (!err) {
      return redirect_login();
    }
    // connect websocket
    murano.connect(product_id, device_rid, dataport_aliases, function(err) {
      if (err) {
       return console.log('Error connecting websocket', err);
      }
    }
  });
*/

'use strict';
const MuranoOneP = function(options) {
  var websocket_url = options.websocket_url;

  var _muranoBase = new MuranoBase(options);

  var URL_rpc = "/proxy/onep:v1/rpc/process";
  var URL_provision = "/proxy/provision"
  var ONEP_TOKEN_TTL_SECONDS = 86400; // 24 hours


  function provision_get(product_id, path, callback) {
    _muranoBase.ajax_token({
      url: _muranoBase.product_api_url + product_id + URL_provision + path,
      method: "GET",
        success: function (result) {
        callback(null, result);
      },
      error: function (xhr, status, error) {
        callback(error, xhr, status);
      }
    });
  }
  function RPC(product_id, request, callback) {
    _muranoBase.ajax_token({
      url: _muranoBase.product_api_url + product_id + URL_rpc,
      dataType: "JSON",
      method: "POST",
      data: JSON.stringify(request),
      headers: {
        'content-type': 'application/json; charset=utf-8'
      },
      beforeSend: function (xhr) {
        try {
          _.each(currentSettings.headers, function (header) {
            var name = header.name;
            var value = header.value;

            if (!_.isUndefined(name) && !_.isUndefined(value)) {
              xhr.setRequestHeader(name, value);
            }
          });
        }
        catch (e) {
        }
      },
      success: function (result) {
        // TODO: check for RPC errors
        callback(null, result);
      },
      error: function (xhr, status, error) {
        callback(error, xhr, status);
      }
    });
  };

  // set up a websocket connection to a device
  function setup_websocket(product_id, device_rid, dataport_aliases, callback) {
    // Create 1P token with read and write permission for specified dataports
    var permissions = {};
    permissions[device_rid] = {
      read: dataport_aliases, 
      write: dataport_aliases,
      subscribe: dataport_aliases
    };
    RPC(product_id, {auth: {client_id: device_rid}, calls: [{
      id: 0, 
      procedure: 'grant',
      arguments: [
        device_rid,
        permissions,
        {ttl: ONEP_TOKEN_TTL_SECONDS}
      ]}]},
      function(err, result) {
        if (result[0].status !== 'ok') {
          return callback ('Bad status from RPC: ' + result[0].status); 
        }
        var onep_token = result[0].result;
        console.log('onep_token', onep_token);
        // create websocket and authenticate 
        _reconnect = function(callback) {
          _socket = new WebSocket(websocket_url);

          _socket.onopen = function(evt) {
            switch(_socket.readyState) {
              case WebSocket.CONNECTING: 
                console.log('CONNECTING The connection is not yet open.');
                break;
              case WebSocket.OPEN:
                console.log('OPEN The connection is open and ready to communicate.');
                break;
              case WebSocket.CLOSING:
                console.log('CLOSING The connection is in the process of closing.');
                break;
              case WebSocket.CLOSED:
                console.log('CLOSED The connection is closed or couldn\'t be opened.');
                break;
            }
            console.log('websocket connection opened. Sending auth...');
            _socket.send(JSON.stringify({'auth': {'token': onep_token}}));
            _socket.onmessage = function(evt) {
              // disable message handling until we're ready to 
              // register the real message handler
              _socket.onmessage = function(evt) {};

              console.log(evt);
              var response = JSON.parse(evt.data);
              if (response.status !== 'ok') {
                console.log('error authenticating websocket', evt);
                callback(response.status);
              }

              // websocket is open and authed
              // current time UTC. TODO: set this to the timestamp of last datapoint
              // for each device. If the browser's clock is off from the server this 
              // could cause the last point to be displayed twice.
              var since = Math.floor(new Date().getTime() / 1000);

              console.log('websocket is open and authed. Subscribing to device RID', device_rid);
              _.each(dataport_aliases, function(dataport_alias) {
                var subscription_id = dataport_alias;
                console.log('subscribing to', dataport_alias);
                _socket.send(JSON.stringify({calls: [{
                  id: dataport_alias,
                  procedure: 'subscribe',
                  arguments: [
                    {alias: dataport_alias, rid: device_rid},
                    {
                      since: since,
                      /*subs_id: subscription_id*/
                    }
                  ]
                }]}));
              });
              _socket.onmessage = function(evt) {
                var data = JSON.parse(evt.data);
                _.each(data, function(response) {
                  if (response.status === 'ok') {
                    if (_callbacks[response.id] && response.hasOwnProperty('result')) {
                      _callbacks[response.id](response.result[1]);
                    }
                  } else {
                    console.log('Response error status', repsonse.status);
                  }
                });
              }
              callback(null);
            }
          }
          _socket.onclose = function() {
            console.log('websocket closed. Reconnecting...');
            _reconnect(function(err) {
              if (err) {
                callback('_reconnect error', err);
              }
            });
          }
        }
        _reconnect(function (err) {
          callback(err);
        });
      });
  }

  var _socket = null;
  var _reconnect = null;
  // callback functions for each dataport alias
  var _callbacks = {};

  // Usage: call init() to do sso, then connect() to connect websocket
  const me = {
    ERROR_CODES: _muranoBase.ERROR_CODES,
    get_connected_device: function() {
      var device = null;
      if (me.product_id && me.device_rid) {
        device = {
          product_id: me.product_id,
          device_rid: me.device_rid,
          device_id: me.device_id
        };
      }
      return device;
    },
    /* create token and connect websocket to 1P. This websocket
       is shared by all datasources for this device.  */
    connect: function(product_id, device_id, callback) {
      // save the current product and device IDs
      me.product_id = product_id;
      me.device_id = device_id;

      me.get_device_rid_by_identity(product_id, device_id, function(err, device_rid) {
        if (err) {
          return callback(err);
        }
        // save the RID
        me.device_rid = device_rid;

        // add freeboard datasources for each dataport
        me.get_device_resources(product_id, device_rid, function(err, dataports) {
          if (err) {
            return callback(err);
          }
          // set up websocket
          setup_websocket(product_id, device_rid, _.pluck(dataports, 'alias'), function(err) {
            callback(err, device_rid, dataports);            
          });
        });
      });
    },
    /* disconnect websocket and drop token */
    disconnect: function() {
      _socket.onclose = function() {};
      _socket.close()
    },
    save_dashboard: _muranoBase.save_dashboard,
    load_dashboard: _muranoBase.load_dashboard,
    init: _muranoBase.init,
    get_latest_point_for: function(product_id, device_id, device_rid, dataport_alias, callback) {
      RPC(product_id, {auth: {client_id: device_rid}, calls: [{
        id: 0, 
        procedure: 'read',
        arguments: [
          {alias: dataport_alias},
          {}
        ]}]},
        function(err, result) {
          if (err) {
            console.log('Error from get_latest_point_for:', err);
            return callback(err);
          }
          if (result[0].status !== 'ok') {
            return callback ('Bad status from RPC: ' + result[0].status); 
          }
          callback(err, result[0].result[0]);
        });
    },
    write_value_for: function(product_id, device_rid, dataport_alias, value, callback) {
      RPC(product_id, {auth: {client_id: device_rid}, calls: [{
        id: 0, 
        procedure: 'write',
        arguments: [
          {alias: dataport_alias},
          value 
        ]}]},
        function(err, result) {
          if (result[0].status !== 'ok') {
            return callback ('Bad status from RPC: ' + result[0].status); 
          }
          callback(err, result[0].result[0]);
        });
    },
    // register callback to call when data comes in on dataport_alias
    listen_for: function(product_id, device_rid, dataport_alias, callback) {
      _callbacks[dataport_alias] = callback;
    },
    // unregister callback for data on dataport_alias
    stop_listening_for: function(product_id, device_rid, dataport_alias) {
      _callbacks[dataport_alias] = null;
    },
    /*
     * Look up RID by serial number
     */
    get_device_rid_by_identity: function(product_id, identity, callback) {
      var url = _muranoBase.product_api_url + product_id + URL_provision;
      provision_get(product_id, '/manage/model/' + product_id + '/' + identity, function(err, result) {
        if (err) { return callback(err); }
        callback(err, result.split(',')[1]);
      });
    },
    /*
     * Get an array of dataports for device
     * { rid: <rid>, alias: <alias> }
     */
    get_device_resources: function(product_id, device_rid, callback) {
      RPC(product_id, 
        {auth: {client_id: device_rid}, calls: [
          {id: 0, procedure: 'listing', arguments: [{alias: ''}, ['dataport'], {}]},
          {id: 1, procedure: 'info', arguments: [{alias: ''}, {aliases: true}]}
        ]},
        function(err, result) {
          if (err) { return callback(err); }
          if (result[0].status !== 'ok' || result[1].status !== 'ok') { 
            return callback ('Bad status from RPC in get_device_resources'); 
          }
          rids = result[0].result.dataport;
          aliases = result[1].result.aliases;
          var dataports = [];
          _.each(rids, function(rid) {
            if (_.has(aliases, rid)) {
              dataports.push({
                rid: rid,
                alias: aliases[rid][0], // 0 - alias is first in alias array
                info: null  // TODO: get info to determine dataport type
              });
            }
          });
          callback(err, dataports);
        });
    }
  };

  return me;
}
