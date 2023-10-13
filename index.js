var Service, Characteristic;
const request = require('request');

const DEF_INTERVAL = 1000; //1s
const DIFFERENCE_IN_SECONDS = 10;

const URL = "https://www.oref.org.il/WarningMessages/History/AlertsHistory.json";
const HTTP_METHOD = "GET";
const JSON_RESPONSE = "data";
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

   // url info
   this.url = URL;
   this.http_method = HTTP_METHOD;
   this.json_response = JSON_RESPONSE;
   this.headers = HEADERS;
   MissilesAlert
   this.name = config["name"];
   this.manufacturer = "Gal Mirkin";
   this.model = "MissilesAlerts";
   this.serial = "RVU729";
   
   this.update_interval = Number( config["update_interval"] || DEF_INTERVAL );
   this.city = config["city"] || "all";

   // Internal variables
   this.last_state = false;
   this.waiting_response = false;
}

HttpMotion.prototype = {

  
   updateState: function () {
      // Ensure previous call finished
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
  
          if (error) {
              this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
          } else if (body === '') {
              error = true;
          } else {
              try {
                  var alerts = JSON.parse(body);
  
                  // Filter alerts from the last 10 seconds and category equals 1:
                  var now = new Date();
                  var recentAlerts = alerts.filter(alert => {
                      var alertTime = new Date(alert.alertDate.replace(' ', 'T') + 'Z'); // Convert to ISO format for parsing
                      var differenceInSeconds = (now - alertTime) / 1000; // Convert milliseconds to seconds
                      return differenceInSeconds <= DIFFERENCE_IN_SECONDS && alert.category === 1;
                  });
  
                  this.log("Recent alarms in the last 10 seconds: " + recentAlerts.map(a => a.data));
  
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
              this.log("Your city is under attack! Get to the shelters right now!!");
          }
  
          this.motionService
              .getCharacteristic(Characteristic.MotionDetected).updateValue(value, null, "updateState");
  
          this.last_state = value;
          this.waiting_response = false;
      });
  },
  

   getState: function (callback) {
      var state = this.last_state;
      var update = !this.waiting_response;
      var sync = this.update_interval === 0;
      if (update) {
         this.log('Call to getState: last_state is "' + state + '", will update state now "' + update + '"' );
         setImmediate(this.updateState.bind(this));
      }
      callback(null, state);
   },

   getServices: function () {
      this.log("City is set to " + this.city)
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