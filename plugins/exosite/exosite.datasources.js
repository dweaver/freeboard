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
          currentSettings.dataport_id, function (err, point) {
				if (err) {
					//onNewData({});
          console.log(err);
				} else {
					onNewData(point[0]);
				}
			});
		}

		this.onDispose = function () {

		}

		this.onSettingsChanged = function (newSettings) {
			freeboard.murano.stop_listening_for(
          currentSettings.product_id, 
          currentSettings.device_rid, 
          currentSettings.dataport_id);

			currentSettings = newSettings;

			freeboard.murano.listen_for(
          currentSettings.product_id, 
          currentSettings.device_rid,
          currentSettings.dataport_id,
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
		"external_scripts": false, // NOTE: empty list causes problems
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
				display_name: "Device Identifier",
				"description": "Example: 00000002",
				type: "text",
        default_value: "6468230c357716cfa34f1677a4d0b8475324506e"
			},
			{
				name: "dataport_id",
				display_name: "Dataport Identifier",
				"description": "Example: food_level",
				type: "text",
        default_value: "temperature"
			}
		],
		newInstance: function (settings, newInstanceCallback, updateCallback) {
      console.log('new instance');
			newInstanceCallback(new muranoDatasource(settings, updateCallback));
		}
	});

}());
