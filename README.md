# Homebridge Missiles Alert

Homebridge plugin for Israeli missile alerts ("צבע אדום" / Red Alert) with HomeKit integration.

This plugin exposes a **HomeKit motion sensor** that turns on when an alert is detected for your configured city, so you can create automations such as turning on lights, sending notifications, or triggering other smart home devices.

Let’s hope you never actually need it.

---

## Features

- **HomeKit Motion Sensor** - Appears in HomeKit as a motion sensor
- **City-based Filtering** - Triggers only for the city you configure
- **Real-time Monitoring** - Checks for active alerts continuously
- **HomeKit Automations** - Use alerts to trigger scenes and devices
- **Simple Setup** - Lightweight accessory configuration
- **Apple TV PiP Notifications** - Optional doorbell camera that shows alert overlay on Apple TV while watching Netflix or other apps

---

## Installation

### Via Homebridge UI

1. Open the **Homebridge** web UI
2. Go to the **Plugins** tab
3. Search for `homebridge-missiles-alert`
4. Click **Install**
5. Configure the accessory in your `config.json`

### Via npm

```bash
npm install -g homebridge-missiles-alert
```

Or install directly from GitHub:

```bash
sudo npm install -g git+https://github.com/gal-m/homebridge-missiles-alert.git
```

---

## Configuration

Add the accessory to your Homebridge `config.json`:

```json
{
  "accessories": [
    {
      "accessory": "MissilesAlert",
      "name": "Missiles Alert",
      "city": "תל אביב - יפו"
    }
  ]
}
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `accessory` | string | Yes | Must be `"MissilesAlert"` |
| `name` | string | Yes | Name of the accessory as shown in HomeKit |
| `city` | string | Yes | City name exactly as it appears on the Pikud HaOref / alert source site |

### Important Notes

- The `city` value must match the source city name **exactly**
- City names are typically in **Hebrew**
- If the configured city does not match exactly, alerts may not trigger

---

## Example Use Cases

Once added to HomeKit, the motion sensor can be used in automations such as:

- Turn on all lights when an alert is detected
- Play a siren or spoken warning on a HomePod
- Flash selected lights in the house
- Trigger a safe-room preparation scene
- Send Home notifications to family members

---

## How It Works

The plugin monitors the alert feed and checks whether the configured city appears in an active missile alert.

When a matching alert is detected:

1. The HomeKit motion sensor turns **on**
2. Any HomeKit automations linked to that sensor are triggered
3. When the alert is no longer active, the sensor resets

---

## Apple TV Picture-in-Picture Notifications (Optional)

This plugin supports **Picture-in-Picture alert overlays on Apple TV** - even while watching Netflix, YouTube, or other apps.

When an alert triggers, a doorbell camera notification appears as a PiP overlay showing the alert message in Hebrew.

### Setup

**1. Add the camera platform to your `config.json`:**

```json
{
  "platforms": [
    {
      "platform": "MissilesAlertCamera",
      "name": "Siren Camera"
    }
  ]
}
```

**2. Restart Homebridge**

**3. Add the camera to HomeKit:**
- Open the **Home** app on iPhone/iPad
- Tap **+** → **Add Accessory** → **More Options**
- Select "Siren Camera" and enter your Homebridge pairing code

### Disabling Apple TV Notifications

The Apple TV feature is **completely optional**. If you don't want it, simply don't add the `MissilesAlertCamera` platform to your config. The motion sensor works independently.

### Requirements

- Apple TV 4K or Apple TV HD
- Apple TV linked to the same HomeKit home
- ffmpeg installed on the Homebridge server (`sudo apt install ffmpeg` on Raspberry Pi)

---

## Troubleshooting

### Motion sensor does not trigger

- Make sure the `city` name is written exactly as expected
- Check the Homebridge logs for plugin errors
- Confirm the plugin is loaded successfully in Homebridge
- Test with a city that frequently appears in alerts to verify configuration

### Homebridge does not load the plugin

- Make sure the plugin was installed globally
- Restart Homebridge after installation
- Verify the accessory name is exactly `"MissilesAlert"`

---

## Safety Notice

This plugin is provided for convenience and home automation purposes only.

It is **not** an official warning system and must **not** be relied upon as your primary source of safety alerts. Always follow official guidance and use official alert channels and devices provided by the relevant authorities.

---

## Legal Disclaimer

This is an independent community project and is not affiliated with, endorsed by, or approved by any governmental authority, including the Israeli Ministry of Defense or the Home Front Command.

The software is provided **"as is"** without warranty of any kind.

---

## Credits

Many thanks to [tzevaadom.co.il](https://www.tzevaadom.co.il) for providing the API used by this project.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## License

ISC
