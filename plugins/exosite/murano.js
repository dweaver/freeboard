/* Murano API client library
 
 Example usage:
  // instantiate Murano library
  var murano = new Murano({
    api_url: API_URL,
    websocket_url: WEBSOCKET_URL,
    error: function(code, options) {
      // handle general errors here
      if (code === murano.API_ERRORS.BAD_TOKEN) {
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
const Murano = function(options) {
  var _token = null;
  var api_url = options.api_url;
  var websocket_url = options.websocket_url;
  var error_fn = options.error;
  var URL_base = api_url + "/api:1/product/";
  var URL_rpc = "/proxy/onep:v1/rpc/process";
  var URL_provision = "/proxy/provision"
  var ONEP_TOKEN_TTL_SECONDS = 86400; // 24 hours

  // make an ajax call to murano API, calling general error handler
  // instead of options.error if the token is bad.
  function ajax_token(options) {
    var wrapped_error = options.error;
    options.error = function(xhr, status, error) {
      www_authenticate = xhr.getResponseHeader('www-authenticate');
      if (xhr.status === 401 && www_authenticate && www_authenticate.substr(0,5) == "token") {
        // token is invalid, so app needs to handle that
        error_fn(me.API_ERRORS.BAD_TOKEN, {
          original_handler: function() {
            if (wrapped_error) {
              wrapped_error(xhr, status, error);
            }
          }
        });
      } else {
        if (wrapped_error) {
          wrapped_error(xhr, status, error);
        } 
      }
    };
    options.headers = options.headers || {};
    options.headers.authorization = 'Token ' + _token;
    $.ajax(options);
  }

  function provision_get(product_id, path, callback) {
    ajax_token({
      url: URL_base + product_id + URL_provision + path,
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
    ajax_token({
      url: URL_base + product_id + URL_rpc,
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

  var _socket = null;
  var _reconnect = null;
  // callback functions for each dataport alias
  var _callbacks = {};

  // Usage: call init() to do sso, then connect() to connect websocket
  const me = {
    ERROR_CODES: {
      BAD_TOKEN: 'BAD_TOKEN'
    },
    /* create token and connect websocket to 1P. This websocket
       is shared by all datasources for this device.  */
    connect: function(product_id, device_rid, dataport_aliases, callback) {
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
                  console.log('_socket.onmessage', evt);
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
    },
    /* disconnect websocket and drop token */
    disconnect: function() {
      _socket.onclose = function() {};
      _socket.close()
    },
    init: function(callback) {
      // get session token
      // intentionally using $.ajax here instead of ajax_token
      $.ajax(api_url + '/session', {
        success: function(data) {
          if (!data.hasOwnProperty('apitoken')) {
            callback('NO_TOKEN');
          } else {
            // set token for module
            _token = data.apitoken;
            // Check that the token is not expired
            // intentionally using $.ajax here instead of ajax_token
            $.ajax(api_url + '/api:1/token/' + _token, {
              success: function(data) {
                callback(null);
              },
              error: function(xhr, status, error) {
                console.log(status, error);
                // /session returned a token, but that token is not good (expired?)
                callback('EXPIRED_TOKEN');
              }
            });
          }
        },
        error: function(xhr, status, error) {
          console.log(status, error);
          callback('FAIL_TOKEN');
        },
        xhrFields: {
          withCredentials: true
        }
      });
    },
    get_latest_point_for: function(product_id, device_rid, dataport_alias, callback) {
      RPC(product_id, {auth: {client_id: device_rid}, calls: [{
        id: 0, 
        procedure: 'read',
        arguments: [
          {alias: dataport_alias},
          {}
        ]}]},
        function(err, result) {
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
      console.log('listen_for', dataport_alias);
      _callbacks[dataport_alias] = callback;
    },
    // unregister callback for data on dataport_alias
    stop_listening_for: function(product_id, device_rid, dataport_alias) {
      console.log('stop_listening_for', dataport_alias);
      _callbacks[dataport_alias] = null;
    },
    /*
     * Look up RID by serial number
     */
    get_device_rid_by_identity: function(product_id, identity, callback) {
      var url = URL_base + product_id + URL_provision;
      provision_get(product_id, '/manage/model/' + product_id + '/' + identity, function(err, result) {
        console.log('provision /manage/model', err, result);
        if (err) { return callback(err); }
        callback(err, result.split(',')[1]);
      });
    },
    /*
     * Get an array of dataports for device
     * { rid: <rid>, alias: <alias> }
     */
    get_device_dataports: function(product_id, device_rid, callback) {
      RPC(product_id, 
        {auth: {client_id: device_rid}, calls: [
          {id: 0, procedure: 'listing', arguments: [{alias: ''}, ['dataport'], {}]},
          {id: 1, procedure: 'info', arguments: [{alias: ''}, {aliases: true}]}
        ]},
        function(err, result) {
          console.log('result from dataports RPC:');
          console.log(err, result);
          if (err) { return callback(err); }
          if (result[0].status !== 'ok' || result[1].status !== 'ok') { 
            return callback ('Bad status from RPC in get_device_dataports'); 
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
