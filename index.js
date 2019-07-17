const remote = require('selenium-webdriver/remote');
const chrome = require('selenium-webdriver/chrome');
const ie = require('selenium-webdriver/ie');
const safari = require('selenium-webdriver/safari');
const edge = require('selenium-webdriver/edge');
const firefox = require('selenium-webdriver/firefox');
const io = require('selenium-webdriver/io');
const webdriver = require('selenium-webdriver');

const { Browser, Capability, Capabilities } = require('selenium-webdriver');

const TrueautomationCapability = {
  DRIVER: 'driver',
  DRIVER_VERSION: 'driverVersion',
};

const DriverName = {
  CHROME: 'chromedriver',
  FIREFOX: 'geckodriver',
  EDGE: 'microsoftwebdriver',
  SAFARI: 'safaridriver'
};

const TRUEAUTOMATION_EXE = 'trueautomation';

function locateSynchronously() {
  return io.findInPath(TRUEAUTOMATION_EXE, true);
}

class ServiceBuilder extends remote.DriverService.Builder {
  constructor(opt_exe) {
    const exe = opt_exe || locateSynchronously();

    if (!exe) {
      throw Error(
        'The TrueAutomation.IO executable can not be found. Please install TrueAutomation.IO client');
    }
    super(exe);
  }

  /**
   * Sets the path of the log file the driver should log to. If a log file is
   * not specified, the driver will log to stderr.
   * @param {string} path Path of the log file to use.
   * @return {!ServiceBuilder} A self reference.
   */
  loggingTo(path) {
    if (path) this.addArguments('--log-file=' + path);
    return this;
  }

  /**
   * Sets the driver and driver version that should be started. If
   * not specified, it have to start default driver.
   * @param {string, string} driver name and version.
   * @return {!ServiceBuilder} A self reference.
   */
  driverTo(name, version) {
    if (name) {
      this.addArguments('--driver=' + name);
      if (version) this.addArguments('--driver-version=' + version);
    }

    return this;
  }
}

class CapabilitiesBuilder {
  constructor(capabilities) {
    this._capabilities = capabilities || new Capabilities();
  }

  withRemoteAddress(remoteAddress) {
    this._capabilities.set('taRemoteUrl', remoteAddress);
    return this;
  }

  build() {
    return this._capabilities;
  }
}

class Builder extends webdriver.Builder {
  constructor() {
    super();
  }

  build() {
    const capabilities = new Capabilities(this.capabilities_);

    let browser;
    let driverName;
    let driverVersion;
    if (!this.ignoreEnv_ && process.env.SELENIUM_BROWSER) {
      this.log_.fine(`SELENIUM_BROWSER=${process.env.SELENIUM_BROWSER}`);
      browser = process.env.SELENIUM_BROWSER.split(/:/, 3);
      capabilities.setBrowserName(browser[0]);

      browser[1] && capabilities.setBrowserVersion(browser[1]);
      browser[2] && capabilities.setPlatform(browser[2]);
    }

    browser = capabilities.get(Capability.BROWSER_NAME);
    driverName = capabilities.get(TrueautomationCapability.DRIVER);
    driverVersion = capabilities.get(TrueautomationCapability.DRIVER_VERSION);

    if (typeof browser !== 'string') {
      throw TypeError(
        `Target browser must be a string, but is <${typeof browser}>;` +
        ' did you forget to call forBrowser()?');
    }

    if (browser === 'ie') {
      browser = Browser.INTERNET_EXPLORER;
    }


    // Apply browser specific overrides.
    if (browser === Browser.CHROME && this.chromeOptions_) {
      capabilities.merge(this.chromeOptions_);
    } else if (browser === Browser.FIREFOX && this.firefoxOptions_) {
      capabilities.merge(this.firefoxOptions_);
    } else if (browser === Browser.INTERNET_EXPLORER && this.ieOptions_) {
      capabilities.merge(this.ieOptions_);
    } else if (browser === Browser.SAFARI && this.safariOptions_) {
      capabilities.merge(this.safariOptions_);
    } else if (browser === Browser.EDGE && this.edgeOptions_) {
      capabilities.merge(this.edgeOptions_);
    }


    checkOptions(
      capabilities, 'chromeOptions', chrome.Options, 'setChromeOptions');
    checkOptions(
      capabilities, 'moz:firefoxOptions', firefox.Options,
      'setFirefoxOptions');
    checkOptions(
      capabilities, 'safari.options', safari.Options, 'setSafariOptions');

    // Check for a remote browser.
    let url = this.url_;
    if (!this.ignoreEnv_) {
      if (process.env.SELENIUM_REMOTE_URL) {
        this.log_.fine(
          `SELENIUM_REMOTE_URL=${process.env.SELENIUM_REMOTE_URL}`);
        url = process.env.SELENIUM_REMOTE_URL;
      } else if (process.env.SELENIUM_SERVER_JAR) {
        this.log_.fine(
          `SELENIUM_SERVER_JAR=${process.env.SELENIUM_SERVER_JAR}`);
        url = startSeleniumServer(process.env.SELENIUM_SERVER_JAR);
      }
    }

    if (url) {
      capabilities.set('taRemoteUrl', url);
      this.url_ = '';
    }

    // Check for a native browser.
    let driver = null;
    switch (browser) {
      case Browser.CHROME:
        driver = chrome.Driver;
        if (!driverName) driverName = DriverName.CHROME;
        break;
      case Browser.FIREFOX:
        driver = firefox.Driver;
        if (!driverName) driverName = DriverName.FIREFOX;
        break;
      case Browser.INTERNET_EXPLORER:
        driver = ie.Driver;
        break;
      case Browser.EDGE:
        driver = edge.Driver;
        if (!driverName) driverName = DriverName.EDGE;
        break;
      case Browser.SAFARI:
        driver = safari.Driver;
        if (!driverName) driverName = DriverName.SAFARI;
        break;
      default:
        throw new Error('Do not know how to build driver: ' + browser
          + '; did you forget to call usingServer(url)?');
    }

    const service = new ServiceBuilder().loggingTo().driverTo(driverName, driverVersion).build();

    const driverProxy = class extends driver {
      constructor(session, ...rest) {
        super(session, ...rest);

        const pd = this.getSession().then(session => {
          return new driver(session, ...rest);
        });

        this.then = pd.then.bind(pd);

        this.catch = pd.catch.bind(pd);
      }
    };

    return driverProxy.createSession(capabilities, service);
  }

}

function checkOptions(caps, key, optionType, setMethod) {
  let val = caps.get(key);
  if (val instanceof optionType) {
    throw new error.InvalidArgumentError(
      'Options class extends Capabilities and should not be set as key '
      + `"${key}"; set browser-specific options with `
      + `Builder.${setMethod}(). For more information, see the `
      + 'documentation attached to the function that threw this error');
  }
}

class By extends webdriver.By {
  constructor() {
    super();
  }

  static ta(taName) {
    return By.css('__taonly__' + taName + '__taonly__');
  }
}

exports.Builder = Builder;
exports.CapabilitiesBuilder = CapabilitiesBuilder;
exports.ServiceBuilder = ServiceBuilder;
exports.By = By;
