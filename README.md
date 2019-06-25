TrueAutomation.IO `selenium-webdriver` extension
====

This module allows to use TrueAutomation.IO with [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver).

## Installation

```json
{
  "devDependencies": {
    "trueautomation-selenium-webdriver": "~0.3",
    "trueautomation-helper": "~0.3"
  }
}
```

## Usage

TrueAutomation.IO extension provides an own `Builder` and `ServiceBuilder` for `selenium-webdriver`

### Builder initialization

Use `Builder` provided by TrueAutomation.IO instead of original one:

```javascript
const { By, Key, until } = require('selenium-webdriver');
const { Builder } = require('trueautomation-selenium-webdriver');
const { ta } = require('trueautomation-helper');

(async function example() {
  const driver = new Builder().forBrowser('chrome').build();

  try {
    await driver.get('http://www.google.com/ncr');
    await driver.findElement(By.name(ta('test:test:test', 'q'))).sendKeys('webdriver', Key.RETURN);
    await driver.wait(until.titleIs('webdriver - Google Search'), 1000);
  } finally {
    await driver.quit();
  }
})();
```

You can use it for remote webdriver as well
```javascript
  const driver = new Builder().usingServer('http://remote.host:4455').forBrowser('chrome').build();
```

### Service initialization

Use provided `ServiceBuilder` to create a new service.

```javascript
  const service = new ServiceBuilder().loggingTo('./trueautomation.log').build();
  const options = Capabilities.chrome();
  const driver = chrome.Driver.createSession(options, service);
```

Use `CapabilitiesBuilder` to connect to a remote webdriver.
```javascript
  const service = new ServiceBuilder().loggingTo('./trueautomation.log').build();
  const options = new CapabilitiesBuilder(Capabilities.chrome()).withRemoteAddress('http://remote.host:4455/wd/hub').build();
  const driver = chrome.Driver.createSession(options, service);
```
