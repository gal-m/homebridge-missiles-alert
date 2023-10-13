var Service, Characteristic;
const request = require('request');
const moment = require('moment-timezone');
const DEF_INTERVAL = 2000; //2s
const DIFFERENCE_IN_SECONDS = 5;

const URL = "https://www.oref.org.il/WarningMessages/History/AlertsHistory.json";
const HTTP_METHOD = "GET";
const HEADERS = {
    "Host": "www.oref.org.il",
    "Connection": "close",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Referer": "https://www.oref.org.il/12481-he/Pakar.aspx"
};

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-missilesalert", "MissilesAlert", HttpMotion);
}

function HttpMotion(log, config) {
    this.log = log;
    this.lastAlertDate = null;

    // url info
    this.url = URL;
    this.http_method = HTTP_METHOD;
    this.headers = HEADERS;
    this.name = config["name"];
    this.manufacturer = "Gal Mirkin";
    this.model = "MissilesAlerts";
    this.serial = "RVU729";
    this.update_interval = Number(config["update_interval"] || DEF_INTERVAL);
    this.city = config["city"] || "all";

    // Internal variables
    this.last_state = false;
    this.waiting_response = false;
}

HttpMotion.prototype = {
    updateState: function () {
        if (this.waiting_response) {
            this.log('Avoid updateState as previous response has not arrived yet');
            return;
        }
        this.waiting_response = true;

        var ops = {
            uri: this.url,
            method: this.http_method,
            headers: this.headers
        };

        request(ops, (error, res, body) => {
            var value = false;
            var recentAlerts = [];
            
            if (error) {
                this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
            } else if (!body) {
                error = true;
            } else {
                try {
                    var alerts = JSON.parse(body);
                    var now = moment.tz("Asia/Jerusalem");
                    recentAlerts = alerts.filter(alert => {
                        var alertTime = moment.tz(alert.alertDate, "Asia/Jerusalem");
                        var differenceInSeconds = moment.duration(now.diff(alertTime)).asSeconds();
                        var isNewAlert = this.lastAlertDate ? alertTime.isAfter(this.lastAlertDate) : true;

                        return differenceInSeconds <= DIFFERENCE_IN_SECONDS && alert.category === 1 && isNewAlert;
                    });

                    this.log("Recent alarms in the last 5 seconds: " + recentAlerts.map(a => a.alertDate));

                    if (this.city !== "all") {
                        value = recentAlerts.some(alert => alert.data === this.city);
                    } else {
                        value = recentAlerts.length > 0;
                    }
                } catch (parseErr) {
                    this.log('Error processing received information: ' + parseErr.message);
                    error = parseErr;
                }
            }

            if (value) {
                this.log("Your city is under attack! Get to the shelters right now!");
            }

            if (recentAlerts.length > 0) {
                this.lastAlertDate = moment.tz(recentAlerts[0].alertDate, "Asia/Jerusalem"); // Store the most recent alertDate
            }

            this.motionService
                .getCharacteristic(Characteristic.MotionDetected).updateValue(value, null, "updateState");
            this.last_state = value;
            this.waiting_response = false;
        });
    },

    getState: function (callback) {
        var state = this.last_state;
        if (!this.waiting_response && this.update_interval === 0) {
            this.log('Call to getState: last_state is "' + state + '", will update state now');
            setImmediate(this.updateState.bind(this));
        }
        callback(null, state);
    },

    getServices: function () {
        this.log("City is set to " + this.city);
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial);

        this.motionService = new Service.MotionSensor(this.name);
        this.motionService
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.getState.bind(this));

        if (this.update_interval > 0) {
            this.timer = setInterval(this.updateState.bind(this), this.update_interval);
        }

        return [this.informationService, this.motionService];
    }
};
