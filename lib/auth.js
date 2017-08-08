/**
 * NodeJS Google Authentication for Limited-Input Devices
 * Author: Oliver Woodings oliver.woodings@gmail.com
 * License: MIT (see LICENSE.md)
 */

var EventEmitter = require("events").EventEmitter,
    _ = require("underscore"),
    util = require("util"),
    request = require("request");


/* CONSTANTS */

var events = {
  error: "error",
  userCode: "user_code",
  newAccessToken: "new_access_token",
  authSuccess: "auth_success",
  refreshSuccess: "refresh_success",
  errors: {
    missingClientId: "error.missing_client_id",
    missingScopes: "error.missing_scopes",
    missingClientSecret: "error.missing_client_secret",
    missingRefreshToken: "error.missing_refresh_token",
    authorizationTimeout: "error.authorization_timeout",
    googleError: "error.google_error",
    noUserCode: "error.no_user_code",
    invalidRefreshToken: "error.invalid_refresh_token",
    invalidScope: "error.invalid_scope"
  }
};

var errors = {
  missingClientId: {
    code: "missing_client_id",
    string: "Missing client ID in options"
  },
  missingScopes: {
    code: "missing_scopes",
    string: "Scopes array is empty in options"
  },
  missingClientSecret: {
    code: "missing_client_secret",
    string: "Missing client secret in options"
  },
  missingRefreshToken: {
    code: "missing_refresh_token",
    string: "Missing refresh token in options"
  },
  authorizationTimeout: {
    code: "authorization_timeout",
    string: "User did not authorize in time"
  },
  googleError: {
    code: "google_error",
    string: "Error returned from Google Auth"
  },
  noUserCode: {
    code: "no_user_code",
    string: "Unable to poll endpoint - no usercode data"
  },
  invalidRefreshToken: {
    code: "invalid_refresh_token",
    string: "Invalid refresh token provided"
  },
  invalidScope: {
    code: "invalid_scope",
    string: "Invalid scope provided in options"
  }
};

var defaultOptions = {
  accountsUrl: "https://accounts.google.com",
  codeUrl: "/o/oauth2/device/code",
  tokenUrl: "/o/oauth2/token",
  grantType: "http://oauth.net/grant_type/device/1.0",
  autoAttemptReAuth: true,
  scopes: []
};


/**
 * Allows limited-input devices to authenticate with Google OAuth2. Uses could be a command-line service or applications running on a headless server.
 * The library is event-based so responses can be caught by binding to certain events (all availble in GoogleDeviceAuth.events).
 *
 * For detailed information on Google Limited-Input Device Authorisation, see this article: https://developers.google.com/accounts/docs/OAuth2ForDevices
 *
 * Example usage:
 *
 * var GoogleDeviceAuth = require("google-device-auth");
 *
 * var deviceAuth = new GoogleDeviceAuth({
 *   clientId: "<insert client id>",
 *   clientSecret: "<insert client secret>",
 *   scopes: [
 *     "https://www.googleapis.com/auth/drive"
 *   ]
 * });
 *
 * deviceAuth.on(GoogleDeviceAuth.events.userCode, function(data) {
 *   //This event is emitted after the initial user code request is sent.
 *   //Data contains the response from the Google Code request, in particular two properties, user_code and verification_url, which should be presented to the user.
 *   //The user should then navigate to the URL in a browser and enter the code to authenticate the application.
 *   //Note that there is a timeout (in the expires_in property) for the request - if this time passes, an error will be emitted.
 *   //More info on the responses from the code request can be found on GitHub or here: https://developers.google.com/accounts/docs/OAuth2ForDevices#obtainingacode
 * });
 *
 * deviceAuth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
 *  //This event is emitted when authentication completes successfully
 *  //Data is an object containing the access_token, the token_type, the expires_in time (seconds) for the access_token, and the refresh_token
 *  //The refresh token should be permanently stored and can be used with the GoogleDeviceAuth.refresh() command to get a new access_token when it expires
 *  //More info on the token response can be found on GitHub or here: https://developers.google.com/accounts/docs/OAuth2ForDevices#obtainingatoken
 * });
 *
 * deviceAuth.auth();
 *
 *
 * For more indepth examples and documentation, please see the README.md
 *
 * 
 * @param {Object} options - An object of option overrides.
 *    @param {String} options.clientId - Application Client ID from Google Console
 *    @param {String} options.clientSecret - Applicaton Client Secret from Google Console
 *    @param {Array} scopes - Array of scope strings. For more info on scopes, see the Discovery API https://developers.google.com/discovery/v1/getting_started
 *    @param {String} refreshToken - (optional) Specify a refresh token if you already have one
 *    @param {Boolean} autoAttemptReAuth - (default true) Allow authentication to be reattempted if a token refresh fails
 */
function GoogleDeviceAuth(options) {
  //Apply default options
  this.options = _.extend({}, defaultOptions, options);

  //Make empty auth data object
  this.authData = {};

  //Poll Google Auth endpoint when user codes are returned
  this.on(events.userCode, this._startAuthPoll.bind(this));

  //Auto attempt reauth if allowed
  if (this.options.autoAttemptReAuth) {
    this.on(events.errors.invalidRefreshToken, this.auth.bind(this));
  }
}

util.inherits(GoogleDeviceAuth, EventEmitter);



/** PUBLIC METHODS **/

/**
 * Start the authentication process.
 * If a refresh token is present in the config options, a refresh will be attempted first.
 */
GoogleDeviceAuth.prototype.auth = function() {

  //If refresh token is present and the config lets us, attempt a refresh first 
  if (this.options.refreshToken) {
    return this.refresh();
  }

  //Check options
  if (!this.options.clientId) {
    return this._emitError(errors.missingClientId);
  }
  if (this.options.scopes.length === 0) {
    return this._emitError(errors.missingScopes);
  }
  if (!this.options.clientSecret) {
    return this._emitError(errors.missingClientSecret);
  }

  //Start auth process
  this._requestUserCode();

};

/**
 * Attempt a token refresh.
 * If no refresh token is provided in the constructor options, an authentication request will be made first.
 * If the refresh fails and autoAttemptReAuth is true, an authentication request will be attempted.
 */
GoogleDeviceAuth.prototype.refresh = function() {

  //If refresh token is not present, attempt an auth first
  if (!this.options.refreshToken) {
    return this.auth();
  }

  //Check options
  if (!this.options.clientId) {
    return this._emitError(errors.missingClientId);
  }
  if (!this.options.clientSecret) {
    return this._emitError(errors.missingClientSecret);
  }

  //Start refresh process
  this._requestTokenRefresh();

};



/** INTERNAL METHODS **/

/**
 * Internal - Initiate a token refresh request
 */
GoogleDeviceAuth.prototype._requestTokenRefresh = function() {
  var options = {
    method: "POST",
    url: this.options.accountsUrl + this.options.tokenUrl,
    form: {
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      refresh_token: this.options.refreshToken,
      grant_type: "refresh_token"
    }
  };
  this._makeRequest(options, this._handleRefreshResponse.bind(this));
};

/**
 * Internal - Initiate a user code request
 */
GoogleDeviceAuth.prototype._requestUserCode = function() {
  var options = {
    method: "POST",
    url: this.options.accountsUrl + this.options.codeUrl,
    form: {
      client_id: this.options.clientId,
      scope: this.options.scopes.join(" ")
    }
  };
  this._makeRequest(options, this._handleUserCodeResponse.bind(this));
};

/**
 * Internal - Starts the token authentication poll that waits until the user completes their authentication
 */
GoogleDeviceAuth.prototype._startAuthPoll = function() {
  //Check if user code object is present
  if (!this._userCode || !(this._userCode instanceof Object)) {
    return this._emitError(errors.noUserCode);
  }

  //Start polling
  this._pollStartTime = new Date();
  this._pollAuthEndpoint();
};

/**
 * Internal - Token authentication poller
 */
GoogleDeviceAuth.prototype._pollAuthEndpoint = function() {
  //Check if authorization attempt has expired
  var now = new Date();
  if ((now - this._pollStartTime) / 1000 > this._userCode.expires_in) {
    return this._emitError(errors.authorizationTimeout);
  }

  //Request options
  var options = {
    method: "POST",
    url: this.options.accountsUrl + this.options.tokenUrl,
    form: {
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      code: this._userCode.device_code,
      grant_type: this.options.grantType
    }
  };

  //Make poll request
  this._makeRequest(options, this._handlePollResponse.bind(this));
};

/**
 * Internal - Handle token authentication poll response
 * @param {Object} data - JSON data from request
 */
GoogleDeviceAuth.prototype._handlePollResponse = function(data) {
  //If access token present then request was successful
  if (data.access_token) {
    this._storeAuthData(data);
    this.emit(events.authSuccess, data);
  }

  //Else if authorization pending error or slow down error, try again
  else if (data.error && (data.error == "authorization_pending" || data.error == "slow_down")) {
    //If error is slow down, increment the poll interval by 1
    if (data.error == "slow_down") {
      this._userCode.interval++;
    }
    setTimeout(this._pollAuthEndpoint.bind(this), this._userCode.interval);
  }

  //Otherwise, emit Google error
  else {
    this._emitError(errors.googleError, data);
  }
};

/**
 * Internal - Handle response from token refresh
 * @param {Object} data - JSON data from request
 */
GoogleDeviceAuth.prototype._handleRefreshResponse = function(data) {
  //On success, emit refresh success
  if (data.access_token) {
    this._storeAuthData(data);
    this.emit(events.refreshSuccess, data);
  }
  //If invalid token, emit invalid refresh token error
  else if (data.error && data.error == "invalid_grant") {
    this._emitError(errors.invalidRefreshToken, data);
  }
  //Otherwise emit generic Google error
  else {
    this._emitError(errors.googleError, data);
  }
};

/**
 * Internal - Handle response from user code request
 * @param {Object} data - JSON data from request
 */
GoogleDeviceAuth.prototype._handleUserCodeResponse = function(data) {
  //Check for errors
  if (data.error && data.error == "invalid_scope") {
    return this._emitError(errors.invalidScope, data);
  } else if (data.error) {
    return this._emitError(errors.googleError, data);
  }

  //Store usercode
  this._userCode = data;
  //Emit user code event
  this.emit(events.userCode, data);
};



/** UTILITY **/

/**
 * Stores authentication data returned by requests to Google authentication
 * Also triggers a newAccessToken event with the full data object
 * @param  {Object} data - Data returned from successful auth/refresh request
 */
GoogleDeviceAuth.prototype._storeAuthData = function(data) {
  _.extend(this.authData, data);
  this.options.refreshToken = data.refresh_token || this.options.refreshToken;
  this.emit(events.newAccessToken, data);
};

/**
 * Utility - Wrapper for making post requests. Handles errors and JSON parsing
 * @param  {Object}   options  - Object containing options for the request
 * @param  {Function} callback - callback to be passed the request data
 */
GoogleDeviceAuth.prototype._makeRequest = function(options, callback) {
  request.post(options, (function(err, response, body) {
    //Check for request errors
    if (err) {
      return this.emit(events.error, err);
    }

    //Parse body into JSON
    var data = JSON.parse(body);

    callback(data);
  }).bind(this));
};

/**
 * Utility - Emits an application error event with data if required
 * @param  {Object} type - Error type object containing the code and error string
 * @param  {Object} data - (optional) Any additional data to be attached to the error
 */
GoogleDeviceAuth.prototype._emitError = function(type, data) {
  var error = new Error(type.string);
  error.code = type.code;
  if (data) {
    error.data = data;
  }
  this.emit("error." + type.code, error);
  this.emit(events.error, error);
};

//Attatch constants to main class for transparency
GoogleDeviceAuth.events = events;
GoogleDeviceAuth.errors = errors;
GoogleDeviceAuth.defaultOptions = defaultOptions;

module.exports = GoogleDeviceAuth;
