/**
 * Homebridge Missiles Alert Plugin with Apple TV PiP Support
 * Based on gal-m/homebridge-missiles-alert
 * Enhanced with doorbell camera for Apple TV Picture-in-Picture notifications
 */

var Service, Characteristic, UUIDGen;
const request = require('request');
const { spawn } = require('child_process');
const path = require('path');

const DEF_INTERVAL = 2000; // 2s

const URL = "https://api.tzevaadom.co.il/notifications";
const HTTP_METHOD = "GET";
const HEADERS = {
    "Connection": "close",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
};

// Global reference to camera platform for triggering doorbell from accessory
let cameraPlatformInstance = null;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    // Register the original accessory (motion sensor)
    homebridge.registerAccessory("homebridge-missiles-alert", "MissilesAlert", MissilesAlert);

    // Register new platform for camera doorbell
    homebridge.registerPlatform("homebridge-missiles-alert", "MissilesAlertCamera", MissilesAlertCameraPlatform);
};

/**
 * Original Motion Sensor Accessory
 */
function MissilesAlert(log, config) {
    this.log = log;
    this.lastNotificationId = null;

    // Error counters
    this.httpErrorResponseCount = 0;
    this.jsonParseErrorCount = 0;
    this.updateStateResponsePendingCount = 0;

    // url info
    this.url = URL;
    this.http_method = HTTP_METHOD;
    this.headers = HEADERS;
    this.name = config["name"];
    this.manufacturer = "Gal Mirkin";
    this.model = "MissilesAlerts";
    this.serial = "RVU729";
    this.update_interval = Number(config["update_interval"] || DEF_INTERVAL);
    this.cities = config["cities"] || ["all"];

    // Internal variables
    this.last_state = false;
    this.waiting_response = false;
}

MissilesAlert.prototype = {
    updateState: function () {
        if (this.waiting_response) {
            this.updateStateResponsePendingCount++;
            if (this.updateStateResponsePendingCount >= 20) {
                this.updateStateResponsePendingCount = 0;
            }
            return;
        }
        this.updateStateResponsePendingCount = 0;
        this.waiting_response = true;

        var ops = {
            uri: this.url,
            method: this.http_method,
            headers: this.headers
        };

        request(ops, (error, res, body) => {
            var value = false;

            if (error) {
                this.httpErrorResponseCount++;
                if (this.httpErrorResponseCount >= 10) {
                    this.log('HTTP bad response (' + ops.uri + ') occurred 10 times in a row: ' + error.message);
                    this.httpErrorResponseCount = 0;
                }
            } else if (!body) {
                error = true;
            } else {
                try {
                    var alerts = JSON.parse(body);

                    alerts.forEach(alert => {
                        // Check if the alert hasn't been processed before and contains the desired city
                        if (this.lastNotificationId !== alert.notificationId &&
                            (this.cities.includes("all") || alert.cities.some(city => this.cities.includes(city)))) {
                            value = true;
                            this.lastNotificationId = alert.notificationId;
                            this.log("Your city is under attack! Get to the shelters right now!");

                            // Trigger Apple TV doorbell if camera platform is available
                            if (cameraPlatformInstance) {
                                cameraPlatformInstance.ringDoorbell();
                            }
                        }
                    });

                    this.httpErrorResponseCount = 0;
                    this.jsonParseErrorCount = 0;
                } catch (parseErr) {
                    this.jsonParseErrorCount++;
                    if (this.jsonParseErrorCount >= 10) {
                        this.log('Error processing received information occurred 10 times in a row: ' + parseErr.message);
                        this.jsonParseErrorCount = 0;
                    }
                    error = parseErr;
                }
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
        this.log("Cities are set to " + this.cities.join(", "));
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

/**
 * Camera Platform for Apple TV Doorbell notifications
 */
class MissilesAlertCameraPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config || {};
        this.api = api;
        this.accessories = [];

        this.name = config.name || "Missiles Alert Camera";
        this.videoProcessor = config.videoProcessor || "ffmpeg";
        this.mediaPath = config.mediaPath || path.join(__dirname, "media");

        // Alert state
        this.currentState = "idle";
        this.resetTimer = null;

        // Store global reference so accessory can trigger doorbell
        cameraPlatformInstance = this;

        if (api) {
            api.on("didFinishLaunching", () => {
                this.log.info("Missiles Alert Camera Platform loaded");
                this.setupCamera();
            });
        }
    }

    setupCamera() {
        const uuid = UUIDGen.generate(this.name);
        const accessory = new this.api.platformAccessory(this.name, uuid, this.api.hap.Categories.VIDEO_DOORBELL);

        // Add accessory info
        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Missiles Alert")
            .setCharacteristic(Characteristic.Model, "Siren Doorbell")
            .setCharacteristic(Characteristic.SerialNumber, "MA-CAM-001");

        // Create doorbell service
        const doorbellService = new Service.Doorbell(this.name);
        accessory.addService(doorbellService);

        // Create camera controller
        const delegate = new MissilesAlertStreamingDelegate(this.api.hap, this.config, this.log, this);

        const options = {
            cameraStreamCount: 2,
            delegate: delegate,
            streamingOptions: {
                supportedCryptoSuites: [this.api.hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
                video: {
                    resolutions: [
                        [1920, 1080, 30],
                        [1280, 720, 30],
                        [640, 480, 30],
                        [640, 360, 30],
                        [320, 240, 15],
                    ],
                    codec: {
                        profiles: [this.api.hap.H264Profile.BASELINE],
                        levels: [this.api.hap.H264Level.LEVEL3_1],
                    },
                },
                audio: undefined,
            },
        };

        const cameraController = new this.api.hap.CameraController(options);
        accessory.configureController(cameraController);

        this.cameraController = cameraController;
        this.doorbellService = doorbellService;
        this.delegate = delegate;

        // Publish as external accessory
        this.api.publishExternalAccessories("homebridge-missiles-alert", [accessory]);
        this.log.info("Missiles Alert Camera published - add it in Home app using code from Homebridge");
    }

    // Called by main plugin to ring doorbell
    ringDoorbell() {
        if (!this.doorbellService) return;

        // Clear any existing reset timer
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }

        // Set camera state to alert
        this.currentState = "alert";
        if (this.delegate) this.delegate.setCurrentState("alert");

        this.log.info("Ringing doorbell for missile alert");

        // Small delay to ensure state is ready before Apple TV requests snapshot
        setTimeout(() => {
            this.doorbellService
                .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                .updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
        }, 500);

        // Reset to idle after 30 seconds
        this.resetTimer = setTimeout(() => {
            this.log.info("Resetting camera to idle state");
            this.currentState = "idle";
            if (this.delegate) this.delegate.setCurrentState("idle");
            this.resetTimer = null;
        }, 30000);
    }

    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }
}

/**
 * Streaming delegate for camera
 */
class MissilesAlertStreamingDelegate {
    constructor(hap, config, log, platform) {
        this.hap = hap;
        this.log = log;
        this.platform = platform;
        this.videoProcessor = config.videoProcessor || "ffmpeg";
        this.mediaPath = config.mediaPath || path.join(__dirname, "media");

        this.currentState = "idle";
        this.pendingSessions = new Map();
        this.ongoingSessions = new Map();
    }

    setCurrentState(state) {
        this.currentState = state;
    }

    getCurrentImage() {
        if (this.currentState === "alert") {
            return path.join(this.mediaPath, "alert-still.png");
        }
        return path.join(this.mediaPath, "idle.png");
    }

    handleSnapshotRequest(request, callback) {
        const currentImage = this.getCurrentImage();
        this.log.debug(`Snapshot: ${request.width}x${request.height}, state: ${this.currentState}`);

        const ffmpegArgs = [
            "-i", currentImage,
            "-vf", `scale=${request.width}:${request.height}`,
            "-frames:v", "1",
            "-f", "image2",
            "-"
        ];

        const ffmpeg = spawn(this.videoProcessor, ffmpegArgs, { env: process.env });
        let imageBuffer = Buffer.alloc(0);

        ffmpeg.stdout.on("data", (data) => {
            imageBuffer = Buffer.concat([imageBuffer, data]);
        });

        ffmpeg.on("close", (code) => {
            if (code === 0 && imageBuffer.length > 0) {
                callback(undefined, imageBuffer);
            } else {
                callback(new Error("Snapshot failed"));
            }
        });

        ffmpeg.on("error", (error) => {
            callback(error);
        });
    }

    prepareStream(request, callback) {
        const sessionInfo = {
            address: request.targetAddress,
            videoPort: request.video.port,
            videoSRTP: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]),
            videoSSRC: this.hap.CameraController.generateSynchronisationSource(),
        };

        this.pendingSessions.set(request.sessionID, sessionInfo);

        callback(undefined, {
            video: {
                port: request.video.port,
                ssrc: sessionInfo.videoSSRC,
                srtp_key: request.video.srtp_key,
                srtp_salt: request.video.srtp_salt,
            },
        });
    }

    handleStreamRequest(request, callback) {
        const sessionId = request.sessionID;

        if (request.type === this.hap.StreamRequestTypes.START) {
            const session = this.pendingSessions.get(sessionId);
            if (!session) {
                callback(new Error("No session"));
                return;
            }

            const currentImage = this.getCurrentImage();
            const ffmpegArgs = [
                "-loop", "1",
                "-i", currentImage,
                "-vf", `scale=${request.video.width}:${request.video.height}`,
                "-vcodec", "libx264",
                "-pix_fmt", "yuv420p",
                "-r", String(Math.min(request.video.fps, 15)),
                "-tune", "stillimage",
                "-preset", "ultrafast",
                "-b:v", `${request.video.max_bit_rate}k`,
                "-payload_type", "99",
                "-ssrc", session.videoSSRC.toString(),
                "-f", "rtp",
                "-srtp_out_suite", "AES_CM_128_HMAC_SHA1_80",
                "-srtp_out_params", session.videoSRTP.toString("base64"),
                `srtp://${session.address}:${session.videoPort}?rtcpport=${session.videoPort}&pkt_size=1316`,
            ];

            const ffmpeg = spawn(this.videoProcessor, ffmpegArgs, { env: process.env });
            ffmpeg.on("close", () => this.ongoingSessions.delete(sessionId));
            this.ongoingSessions.set(sessionId, ffmpeg);
            this.pendingSessions.delete(sessionId);
            callback();

        } else if (request.type === this.hap.StreamRequestTypes.STOP) {
            const ffmpeg = this.ongoingSessions.get(sessionId);
            if (ffmpeg) {
                ffmpeg.kill("SIGKILL");
                this.ongoingSessions.delete(sessionId);
            }
            callback();
        } else {
            callback();
        }
    }
}
