/* Murano ADC API client library. Works like murano.js,
 * but works with ADC devices instead of One Platform devices.
 
   See murano.js for example usage.

*/

'use strict';
const MuranoAdc = function(options) {
  // websockets are different between ADC and 1P, so handle them here
  var websocket_url = options.websocket_url;

  var _muranoBase = new MuranoBase(options);

  var _socket = null;
  var _reconnect = null;
  // callback functions for each resource alias
  var _callbacks = {};

  // set up a websocket connection to a device
  function setup_websocket(product_id, device_id, resource_aliases, callback) {
    // create websocket and authenticate 
    var _reconnect = function(callback) {
      _socket = new WebSocket(websocket_url + '/api:1/log/' + product_id + '/events?token=' + _muranoBase.token());

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
        console.log('websocket connection opened.');

        _socket.onmessage = function(evt) {
          var data = JSON.parse(evt.data);
          // filter to only this device and call callbacks with the new value
          if (data.type === 'data_in' && data.identity === device_id) {
            // get the most recent message in the array
            var message = _.max(data.payload, 
              function(message) { return message.timestamp; });

            _.each(_.keys(message.values), function(alias) {
              if (_callbacks[alias]) {
                _callbacks[alias](message.values[alias]);
              }
            });
          }
        }
        // websocket is set up
        callback(null);
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
  }

  // Usage: call init() to do sso, then connect() to connect websocket
  const me = {
    ERROR_CODES: _muranoBase.ERROR_CODES,
    // This is like Murano.get_connected_device, except it doesn't return
    // a device_rid.
    get_connected_device: function() {
      var device = null;
      if (me.product_id && me.device_id) {
        device = {
          product_id: me.product_id,
          // no device_rid. That's a One Platform thing.
          device_id: me.device_id
        };
      }
      return device;
    },
    /* create token and connect websocket to ADC. This websocket
       is shared by all datasources for this device.  */
    connect: function(product_id, device_id, callback) {
      // save the current product and device IDs
      me.product_id = product_id;
      me.device_id = device_id;

      // add freeboard datasources for each dataport
      me.get_device_resources(product_id, device_id, function(err, resources) {
        if (err) {
          return callback(err);
        }
        // set up websocket
        setup_websocket(product_id, device_id, _.pluck(resources, 'alias'), function(err) {
          // device RID doesn't exist for ADC devices
          var device_rid = null;
          callback(err, device_rid, resources);            
        });
      });
    },
    /* disconnect websocket and drop token */
    disconnect: function() {
      _socket.onclose = function() {};
      _socket.close()
    },
    /* save the dashboard configuration */
    save_dashboard: function(product_id, dashboard_id, dashboard_json, callback) {
      _muranoBase.save_dashboard(_muranoBase.service_api_url + product_id + '/device2/dashboard/' + dashboard_id, dashboard_json, callback);
    },
    /* save the dashboard configuration */
    load_dashboard: function(product_id, dashboard_id, callback) {
      _muranoBase.load_dashboard(_muranoBase.service_api_url + product_id + '/device2/dashboard/' + dashboard_id, callback);
    },
    init: _muranoBase.init,
    // Get latest point for device.
    // calls back with [<timestamp>, <value>] for the resource
    get_latest_point_for: function(product_id, device_id, device_rid, dataport_alias, callback) {
      // read the device state, which includes the reported, set, and timestamp 
      // for each resource that has been added and written.
      _muranoBase.ajax_token({
        url: _muranoBase.api_url + '/api:1/service/' + product_id + '/device2/identity/' + device_id + '/state',
        method: 'GET',
        success: function (result) {
          // result looks like this:
          // {"temperature": {"reported": 48, "timestamp": 1487507119720923, "set": 48}, 
          //  "humidity": {"reported": 88, "timestamp": 1487507119746862, "set": 88}}
          
          // has the resource been written yet?
          if (_.has(result, dataport_alias)) {
            var state = result[dataport_alias];
            // timestamp is in milliseconds. Convert to seconds.
            var timestamp_seconds = Math.round(state.timestamp / 1000000.0);
            // Pass back the "reported" value which is the last one heard from the device. 
            // If there's no reported value, pass back the set value.
            var value = _.has(state, 'reported') ? state.reported : state.set;
            callback(null, [timestamp_seconds, value]);
          } else {
            // pass null if resource has not been written yet
            callback(null, null);
          }
        },
        error: function (xhr, status, error) {
          callback(error, xhr, status);
        }
      });
    },
    // Set resource
    write_value_for: function(product_id, device_id, device_rid, dataport_alias, value, format, callback) {
      // read the device state, which includes the reported, set, and timestamp 
      // for each resource that has been added and written.
      var body = {};
      if (typeof value === 'string') {
        // convert number and boolean values to the
        // correct type from string.
        switch (format) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = parseBool(value);
            break;
        }
      }
      body[dataport_alias] = value;
      _muranoBase.ajax_token({
        url: _muranoBase.api_url + '/api:1/service/' + product_id + '/device2/identity/' + device_id + '/state',
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        data: JSON.stringify(body),
        success: function (result) {
          callback(null);
        },
        error: function (xhr, status, error) {
          callback(error, xhr, status);
        }
      });
    },
    // register callback to call when data comes in on dataport_alias
    listen_for: function(product_id, device_rid, resource_alias, callback) {
      _callbacks[resource_alias] = callback;
    },
    // unregister callback for data on dataport_alias
    stop_listening_for: function(product_id, device_rid, resource_alias) {
      _callbacks[resource_alias] = null;
    },
    /*
     * Get an array of resources for device
     * { rid: <rid>, alias: <alias> }
     */
    // TODO: this no longer needs to be exposed externally
    get_device_resources: function(product_id, device_id, callback) {
      _muranoBase.ajax_token({
          url: _muranoBase.api_url + '/api:1/service/' + product_id + '/device2',
          method: 'GET',
          success: function (result) {
            // resources part of the product looks like this: 
            // {'humidity': {'unit': '', 'allowed': ['0:100'], 'format': 'number', 'settable': False}, 
            //  'temperature': {'unit': '', 'allowed': ['0:100'], 'format': 'number', 'settable': False}}
            var resources = _.map(_.keys(result.resources), function(alias) { return {
              alias: alias, 
              format: result.resources[alias].format}; 
            });
            callback(null, resources);
          },
          error: function (xhr, status, error) {
            callback(error, xhr, status);
          }
        });
    }
  };

  return me;
}
