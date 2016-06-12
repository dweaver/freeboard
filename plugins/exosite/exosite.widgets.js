(function () {
	// On/Off switch widget
	freeboard.loadWidgetPlugin({
		// Same stuff here as with datasource plugin.
		"type_name"   : "toggle_switch",
		"display_name": "Toggle Switch",
    "description" : "Writes on/off values to a dataport",
		// **external_scripts** : Any external scripts that should be loaded before the plugin instance is created.
		"external_scripts": null,
		// **fill_size** : If this is set to true, the widget will fill be allowed to fill the entire space given it, otherwise it will contain an automatic padding of around 10 pixels around it.
		"fill_size" : false,
		"settings"    : [
			{
				name          : "title",
				display_name  : "title",
				type          : "text"
			},
      {
        name          : "value",
        display_name  : "Value",
        type          : "calculated"
      },
			{
				name          : "on_value",
				display_name  : "On Value",
				type          : "text",
        default_value : "1"
			},
			{
				name          : "off_value",
				display_name  : "Off Value",
				type          : "text",
        default_value : "0"
			}
		],
		// Same as with datasource plugin, but there is no updateCallback parameter in this case.
		newInstance   : function(settings, newInstanceCallback)
		{
			newInstanceCallback(new toggleSwitchWidgetPlugin(settings));
		}
	});

	// ### Widget Implementation
	//
	// -------------------
	// Here we implement the actual widget plugin. We pass in the settings;
	var toggleSwitchWidgetPlugin = function(settings)
	{
		var self = this;
		var currentSettings = settings;

    // Returns a random integer between min (included) and max (excluded)
    // Using Math.round() will give you a non-uniform distribution!
    function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min)) + min;
    }
    var switch_id = getRandomInt(10000000, 99999999);

		// Here we create an element to hold the text we're going to display. 
    // We're going to set the value displayed in it below.
    var widgetElement = $('<div></div>');
		var titleElement = $('<h2 class="section-title tw-title tw-td"></h2>');
    titleElement.text(settings.title);
    var switchElement = $('<div class="toggle-switch"><input id="cmn-toggle-' + switch_id + '" class="cmn-toggle cmn-toggle-round-flat" type="checkbox"><label for="cmn-toggle-' + switch_id + '"></label></div>');

		var myElement = widgetElement.append(titleElement).append(switchElement);

    // handle switch changes
    switchElement.find('input').click(function() {
      var $this = $(this);
      // $this contains a reference to the checkbox   
      var valueToWrite = null;
      if ($this.is(':checked')) {
        valueToWrite = currentSettings.on_value;
      } else {
        valueToWrite = currentSettings.off_value;
      }
      // TODO: get datasource name from calculated value setting
      // in a less brittle way (this is from WidgetModel)
		  var datasourceRegex = new RegExp("datasources.([\\w_-]+)|datasources\\[['\"]([^'\"]+)", "g");
      var matches = datasourceRegex.exec(currentSettings.value);
      if (matches.length < 2) {
        console.log('Unable to determine datasource name from value setting.');
      } else {
        var datasourceName = matches[1] || matches[2];

        self.handleWidgetEvent({
          type: 'write',
          datasourceName: datasourceName,
          value: valueToWrite
        })
      }
    });

		// **render(containerElement)** (required) : A public function we must implement that will be called when freeboard wants us to render the contents of our widget. The container element is the DIV that will surround the widget.
		self.render = function(containerElement)
		{
			// Here we append our text element to the widget container element.
			$(containerElement).append(myElement);
		}

		// **getHeight()** (required) : A public function we must implement that will be called when freeboard wants to know how big we expect to be when we render, and returns a height. This function will be called any time a user updates their settings (including the first time they create the widget).
		//
		// Note here that the height is not in pixels, but in blocks. A block in freeboard is currently defined as a rectangle that is fixed at 300 pixels wide and around 45 pixels multiplied by the value you return here.
		//
		// Blocks of different sizes may be supported in the future.
		self.getHeight = function()
		{
      return 2;
		}

		// **onSettingsChanged(newSettings)** (required) : A public function we must implement that will be called when a user makes a change to the settings.
		self.onSettingsChanged = function(newSettings)
		{
			// Normally we'd update our text element with the value we defined in the user settings above (the_text), but there is a special case for settings that are of type **"calculated"** -- see below.
      titleElement.text(newSettings.title);
			currentSettings = newSettings;
		}

		// **onCalculatedValueChanged(settingName, newValue)** (required) : A public function we must implement that will be called when a calculated value changes. Since calculated values can change at any time (like when a datasource is updated) we handle them in a special callback function here.
		self.onCalculatedValueChanged = function(settingName, newValue)
		{
      if (settingName === 'value') {
        var switchElement = $("#cmn-toggle-" + switch_id);
        if (newValue === currentSettings.on_value) {
          switchElement.prop( "checked", true);
        } else if (newValue === currentSettings.off_value) {
          switchElement.prop( "checked", false);
        } else {
          console.log("Unexpected switch value " + newValue);
        }
      }
		}

		// **onDispose()** (required) : Same as with datasource plugins.
		self.onDispose = function()
		{
		}
	}
}());
