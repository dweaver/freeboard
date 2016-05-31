// Murano API client library
// TODO: use promise rather than callback
const Murano = function(options) {
  var token = null;
  var yeti_api_url = options.yeti_api_url;
  var URL_base = yeti_api_url + "/api:1/product/";
  var URL_rpc = "/proxy/onep:v1/rpc/process";
  var URL_provision = "/proxy/provision"
  function provision_get(product_id, path, callback) {
    $.ajax({
      url: URL_base + product_id + URL_provision + path,
      method: "GET",
      headers: {
        'authorization': 'Token ' + token
      },
      success: function (result) {
        callback(null, result);
      },
      error: function (xhr, status, error) {
        callback(error, xhr, status);
      }
    });
  }
  function RPC(product_id, request, callback) {
    $.ajax({
      url: URL_base + product_id + URL_rpc,
      dataType: "JSON",
      method: "POST",
      data: JSON.stringify(request),
      headers: {
        'authorization': 'Token ' + token,
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

  const me = {
    init: function(callback) {
      // get token from Yeti
      $.ajax(yeti_api_url + '/session', {
        success: function(data) {
          console.log('data', data);
          if (!data.hasOwnProperty('apitoken')) {
            callback(false);
          } else {
            token = data.apitoken;
            // Check that the token is not expired
            $.ajax(yeti_api_url + '/api:1/token/' + token, {
              success: function(data) {
                callback(token);
              },
              error: function(xhr, status, error) {
                console.log(status, error);
                // /session returned a token, but that token is not good (expired?)
                callback(false);
              }
            });
          }
        },
        error: function(xhr, status, error) {
          console.log(status, error);
          callback(false);
        },
        xhrFields: {
          withCredentials: true
        }
      });
    },
    get_latest_point_for: function(product_id, device_rid, dataport_id, callback) {
      RPC(product_id, {auth: {client_id: device_rid}, calls: [{
        id: 0, 
        procedure: 'read',
        arguments: [
          {alias: dataport_id},
          {}
        ]}]},
        function(err, result) {
          console.log('result from RPC:');
          console.log(err, result);
          if (result[0].status !== 'ok') {
            return callback ('Bad status from RPC: ' + result[0].status); 
          }
          callback(err, result[0].result[0]);
        });
    },
    listen_for: function(product_id, device_rid, dataport_id, callback) {
      console.log('listen_for');
    },
    stop_listening_for: function(product_id, device_rid, dataport_id, callback) {
      console.log('stop_listening_for');
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
