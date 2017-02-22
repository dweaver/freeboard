/*
 Common functionality between MuranoOneP and MuranoOkami.
 Specifically, bizapi calls and dashboard loading
 and saving.
*/
'use strict';
const MuranoBase = function(options) {
  var _token = null;

  // Options
  var api_url = options.api_url;
  var error_fn = options.error;

  var me = {
    api_url: api_url,
    product_api_url: api_url + "/api:1/product/",
    service_api_url: api_url + "/api:1/service/",
    ERROR_CODES: {
      BAD_TOKEN: 'BAD_TOKEN',
      PRODUCT_ACCESS: 'PRODUCT_ACCESS'
    },
    // make an ajax call to murano API, calling general error handler
    // instead of options.error if the token is bad.
    // exceptions is a list of HTTP statuses that should be handled normally
    ajax_token: function(options, exceptions) {
      exceptions = exceptions || [];
      var wrapped_error = options.error;
      options.error = function(xhr, status, error) {
        www_authenticate = xhr.getResponseHeader('www-authenticate');
        if (xhr.status === 401 && www_authenticate && www_authenticate.substr(0,5) == "token") {
          // token is invalid, so app needs to handle that
          error_fn(me.ERROR_CODES.BAD_TOKEN, {
            original_handler: function() {
              if (wrapped_error) {
                wrapped_error(xhr, status, error);
              }
            }
          });
        } else if (xhr.status === 404 && exceptions.indexOf(xhr.status) === -1) {
          // product/device not found or not accessible to the user
          error_fn(me.ERROR_CODES.PRODUCT_ACCESS, {
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
    },
    save_dashboard: function(url, dashboard_json, callback) {
      me.ajax_token({
        url: url,
        method: 'PUT',
        data: dashboard_json,
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }, 
        success: function (result) {
          callback(null, result);
        },
        error: function (xhr, status, error) {
          callback(error, xhr, status);
        }
      });
    },
    load_dashboard: function(url, callback) {
      me.ajax_token({
        url: url,
        method: 'GET',
        success: function (result) {
          callback(null, result);
        },
        error: function (xhr, status, error) {
          callback(error, xhr, status);
        }
      }, [404]);
    },
    init: function(callback) {
      // get session token
      // intentionally using $.ajax here instead of ajax_token
      $.ajax(me.api_url + '/session', {
        success: function(data) {
          if (!data.hasOwnProperty('apitoken')) {
            callback('NO_TOKEN');
          } else {
            // set token for module
            _token = data.apitoken;
            // Check that the token is not expired
            // intentionally using $.ajax here instead of ajax_token
            $.ajax(me.api_url + '/api:1/token/' + _token, {
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
    }
  }
  return me
}
