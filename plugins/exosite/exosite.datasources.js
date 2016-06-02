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
          currentSettings.device_rid, 
          currentSettings.dataport_alias, function (err, point) {
				if (err) {
					//onNewData({});
          console.log('updateNow point error', currentSettings.dataport_alias, err);
				} else {
          console.log('updateNow point', currentSettings.dataport_alias, point);
          if (point) {
            onNewData(point[1]);
          }
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

  console.log('loading datasource plugin');
	freeboard.loadDatasourcePlugin({
		"type_name": "muranoDataport",
		"display_name": "Murano Device Dataport",
		"external_scripts": null, // NOTE: empty list causes problems
		"settings": [
			{
				name: "product_id",
				display_name: "Product Identifier",
				"description": "Example: Pet Food Dispenser",
				type: "text",
        default_value: "qsn4ggiq04er8uxr"
			},
			{
				name: "device_rid",
				display_name: "Device Identity",
				"description": "Example: 00000002",
				type: "text",
        default_value: "6468230c357716cfa34f1677a4d0b8475324506e"
			},
			{
				name: "dataport_alias",
				display_name: "Dataport Alias",
				"description": "Example: food_level",
				type: "text",
        default_value: "temperature"
			}
		],
		newInstance: function (settings, newInstanceCallback, updateCallback) {
			newInstanceCallback(new muranoDatasource(settings, updateCallback));
		}
	});

}());
