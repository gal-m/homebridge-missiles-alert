# homebridge-missiles-alert

This plugin is set as a motion sensor that turns on when there is an alarm "צבע אדום" in the configured city.
With the sensor you could make automations to suit your needs

Let's hope we won't have to test this at all :)


### Installation

1. Install homebridge using: ```npm install -g homebridge```
2. Install this plugin using: ```npm install -g homebridge-missiles-alert``` or sudo npm install -g git+https://github.com/gal-m/homebridge-missiles-alert.git
3. Update your configuration file. See sample-config.json in this repository for a sample.

You can also install this straight from the homebridge web ui.
In the plugins tab, search for redalert.

### Configuration

See the sample-config.file to see an example of working accessory. Following, all available options are explained:

 * ```name``` Accessory name.
 * ```city``` The name of the city (exactly as it says in the pikud horef's site).


## Many thanks to https://www.tzevaadom.co.il that provide the api for the project
