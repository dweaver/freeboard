(function () {

	var muranoDatasource = function (settings, updateCallback) {
		var self = this;
		var currentSettings = settings;

		function onNewData(point) {
			updateCallback(point);
		}

		this.updateNow = function () {
			freeboard.murano.get_latest_point_for(
          currentSettings.product_id, 
          currentSettings.device_id,
          currentSettings.device_rid, 
          currentSettings.dataport_alias, function (err, point) {
				if (err) {
					//onNewData({});
          console.log('updateNow point error', currentSettings.dataport_alias, err);
				} else {
          if (point) {
            // convert to string since some widgets can't 
            // deal with integers
            onNewData(point[1] + '');
          }
				}
			});
		}

    this.writeNow = function(value) {
      freeboard.murano.write_value_for(
        currentSettings.product_id,
        currentSettings.device_rid,
        currentSettings.dataport_alias, 
        value, function (err) {
          if (err) {
            // TODO: display error to UI
            console.log('Error writing to ' + currentSettings.dataport_alias, err);
          } 
        });
    }

		this.onDispose = function () {
		}

		this.onSettingsChanged = function (newSettings) {
			freeboard.murano.stop_listening_for(
          currentSettings.product_id, 
          currentSettings.device_rid, 
          currentSettings.dataport_alias);

			currentSettings = newSettings;

			freeboard.murano.listen_for(
          currentSettings.product_id, 
          currentSettings.device_rid,
          currentSettings.dataport_alias,
          function (point) {
            onNewData(point);
          });
		}

		self.onSettingsChanged(settings);
	};

	freeboard.loadDatasourcePlugin({
		"type_name": "muranoDataport",
		"display_name": "Murano Device Resource",
		"external_scripts": null, // NOTE: empty list causes problems
		"settings": [
			{
				name: "product_id",
				display_name: "Product Identifier",
				"description": "Note: Dashboards are limited to a single product specified in URL",
				type: "text",
        // note: this is only supported for type: text
        configurable: false,
        default_value: function() {
          var device = freeboard.murano.get_connected_device();
          return device ? device.product_id : ''
        }
			},
			{
				name: "device_id",
				display_name: "Device Identity",
				"description": "Note: Dashboards are also limited to a single device specified in URL",
				type: "text",
        // note: this is only supported for type: text
        configurable: false,
        default_value: function() {
          var device = freeboard.murano.get_connected_device();
          return device ? device.device_id : ''
        }
			},
			{
				name: "device_rid",
				display_name: "Device RID",
				"description": "Note: Dashboards are also limited to a single device specified in URL",
				type: "text",
        // note: this is only supported for type: text
        configurable: false,
        visible: false,
        default_value: function() {
          var device = freeboard.murano.get_connected_device();
          return device ? device.device_rid : ''
        }
			},
			{
				name: "dataport_alias",
				display_name: "Resource Alias",
				"description": "Example: food_level",
				type: "text"
			}
		],
		newInstance: function (settings, newInstanceCallback, updateCallback) {
			newInstanceCallback(new muranoDatasource(settings, updateCallback));
		}
	}); 
}());
