const fs = require('node:fs');
const fetch = require('isomorphic-fetch');
const remote = require('selenium-webdriver/remote');
const chrome = require('selenium-webdriver/chrome');
const ie = require('selenium-webdriver/ie');
const safari = require('selenium-webdriver/safari');
const edge = require('selenium-webdriver/edge');
const firefox = require('selenium-webdriver/firefox');
const io = require('selenium-webdriver/io');
const webdriver = require('selenium-webdriver');
const { Command, Name } = require('selenium-webdriver/lib/command');
const { Browser, Capability, Capabilities, until, WebElement } = require('selenium-webdriver');


const TrueautomationCapability = {
  DRIVER: 'driver',
  DRIVER_VERSION: 'driverVersion',
  DEBUG: 'taDebug',
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
    if (path) {
      this.addArguments('--log-file=' + path);
    } else {
      const dir = './log';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      path = `${dir}/trueautomation-${Date.now()}.log`;
      this.addArguments('--log-file=' + path);
    }
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

  taDebug(taDebug) {
    if (taDebug) {
      this.addArguments('--ta-debug');
    }

    return this;
  }

  taRemote(taRemote) {
    if (taRemote) {
      this.addArguments('--remote');
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

  withTaDebug() {
    this._capabilities.set(TrueautomationCapability.DEBUG, true);
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
    let capabilities;
    if (this.capabilities_.has('map_') && this.capabilities_['map_'].has('map_')) {
      capabilities = new Capabilities(this.capabilities_['map_'].get('map_'));
    } else {
      capabilities = new Capabilities(this.capabilities_);
    }

    let browser;
    let driverName;
    let driverVersion;
    let taDebug;
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
    taDebug = capabilities.get(TrueautomationCapability.DEBUG);

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

    let port;
    let hostname;
    if (url) {
      capabilities.set('taRemoteUrl', url);
      this.url_ = '';
      const parsedURL = new URL(url);
      port = parsedURL.port;
      hostname = parsedURL.hostname;
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
        driver = chrome.Driver;
        if (!driverName) driverName = DriverName.SAFARI;
        break;
      default:
        throw new Error('Do not know how to build driver: ' + browser
          + '; did you forget to call usingServer(url)?');
    }

    let service = new ServiceBuilder().loggingTo().driverTo(driverName, driverVersion).taDebug(taDebug);
    if (url) service = service.taRemote(url).setPort(port).setHostname(hostname)
    service = service.build();

    const driverProxy = class extends driver {
      constructor(session, ...rest) {
        super(session, ...rest);

        const pd = this.getSession().then(session => {
          return new driver(session, ...rest);
        });

        this.then = pd.then.bind(pd);

        this.catch = pd.catch.bind(pd);

        this.port_ = service.port_;
        this.address_ = service.address_;
        this.quit = async function () {
          const address = await this.address_;
          const session = await this.session_;
          const windowCloseURL = address + 'session/' + session.id_ + '/window/';
          await fetch(windowCloseURL, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          await fetch(address + 'shutdown');
        }
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

/**
 * Escapes a CSS string.
 * @param {string} css the string to escape.
 * @return {string} the escaped string.
 * @throws {TypeError} if the input value is not a string.
 * @throws {InvalidCharacterError} if the string contains an invalid character.
 * @see https://drafts.csswg.org/cssom/#serialize-an-identifier
 */
function escapeCss(css) {
  if (typeof css !== 'string') {
    throw new TypeError('input must be a string');
  }
  let ret = '';
  const n = css.length;
  for (let i = 0; i  < n; i++) {
    const c = css.charCodeAt(i);
    if (c == 0x0) {
      throw new InvalidCharacterError();
    }

    if ((c >= 0x0001 && c <= 0x001F)
      || c == 0x007F
      || (i == 0 && c >= 0x0030 && c <= 0x0039)
      || (i == 1 && c >= 0x0030 && c <= 0x0039
        && css.charCodeAt(0) == 0x002D)) {
      ret += '\\' + c.toString(16) + ' ';
      continue;
    }

    if (i == 0 && c == 0x002D && n == 1) {
      ret += '\\' + css.charAt(i);
      continue;
    }

    if (c >= 0x0080
      || c == 0x002D                      // -
      || c == 0x005F                      // _
      || (c >= 0x0030 && c <= 0x0039)     // [0-9]
      || (c >= 0x0041 && c <= 0x005A)     // [A-Z]
      || (c >= 0x0061 && c <= 0x007A)) {  // [a-z]
      ret += css.charAt(i);
      continue;
    }

    ret += '\\' + css.charAt(i);
  }
  return ret;
}

class By extends webdriver.By {
  constructor() {
    super();
  }

  static ta(taName) {
    return By.css('__taonly__' + taName + '__taonly__');
  }

  /**
   * Locates elements whose `name` attribute has the given value.
   *
   * @param {string} name The name attribute to search for.
   * @return {!By} The new locator.
   */
  static name(name) {
    return By.css('*[name="' + escapeCss(name) + '"]');
  }
}

WebElement.prototype.setInnerHTML = function(val) {
  const cmd = new Command(Name.EXECUTE_SCRIPT).
    setParameter('script', 'return (function(el, val){ el.innerHTML = val; return;})(arguments[0], arguments[1])').
    setParameter('args', [this, val]);
  return this.execute_(cmd);
}

exports.Builder = Builder;
exports.CapabilitiesBuilder = CapabilitiesBuilder;
exports.ServiceBuilder = ServiceBuilder;
exports.By = By;
exports.until = until;
exports.remote = remote;
exports.chrome = chrome;
exports.ie = ie;
exports.safari = safari;
exports.edge = edge;
exports.firefox = firefox;
exports.fetch = fetch;
