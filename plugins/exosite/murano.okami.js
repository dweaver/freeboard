/* Murano Okami API client library. Works like murano.js,
 * but works with Okami devices instead of One Platform devices.
 
   See murano.js for example usage.

*/

'use strict';
const MuranoOkami = function(options) {
  // websockets are different between Okami and 1P, so handle them here
  var websocket_url = options.websocket_url;

  var _muranoBase = new MuranoBase(options);

  var _socket = null;
  var _reconnect = null;
  // callback functions for each resource alias
  var _callbacks = {};

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
    /* create token and connect websocket to Okami. This websocket
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
        callback(err, null, resources);
        /*setup_websocket(product_id, device_id, _.pluck(resources, 'alias'), function(err) {
          // device RID doesn't exist for Okami devices
          var device_rid = null;
          callback(err, device_rid, resources);            
        });*/
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
    // Get latest point for device.
    // calls back with [<timestamp>, <value>] for the resource
    get_latest_point_for: function(product_id, device_id, device_rid, dataport_alias, callback) {
      // read the device state, which includes the reported, set, and timestamp 
      // for each resource that has been added and written.
      _muranoBase.ajax_token({
        url: _muranoBase.api_url + '/api:1/service/' + product_id + '/gateway/device/' + device_id + '/state',
        method: 'GET',
        success: function (result) {
          console.log('get_latest_point_for result', result);

          // result looks like this:
          // {"temperature": {"reported": 48, "timestamp": 1487507119720923, "set": 48}, 
          //  "humidity": {"reported": 88, "timestamp": 1487507119746862, "set": 88}}
          
          // has the resource been written yet?
          if (_.has(result, dataport_alias)) {
            var state = result[dataport_alias];
            // timestamp is in milliseconds. Convert to seconds.
            var timestamp_seconds = Math.round(state.timestamp / 1000000.0);
            // Pass back the "reported" value which is the last one heard from the device. 
            // Ignore the "set" value.
            callback(null, [timestamp_seconds, state.reported]);
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
    write_value_for: function(product_id, device_rid, dataport_alias, value, callback) {
      throw 'TODO: implement get_value_for';
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
          url: _muranoBase.api_url + '/api:1/service/' + product_id + '/gateway',
          method: 'GET',
          success: function (result) {
            console.log('get_device_resources result', result);
            // resources part of the product looks like this: 
            // {'humidity': {'unit': '', 'allowed': ['0:100'], 'format': 'number', 'settable': False}, 
            //  'temperature': {'unit': '', 'allowed': ['0:100'], 'format': 'number', 'settable': False}}
            var resources = _.map(_.keys(result.resources), function(x) { return {alias: x}; });
            console.log(resources);
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
