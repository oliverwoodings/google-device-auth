var expect = require("expect.js"),
    _ = require("underscore"),
    GoogleDeviceAuth = require("../lib/auth");

beforeEach(function() {
  this.auth = new GoogleDeviceAuth({
    clientId: "testid",
    clientSecret: "testsecret",
    scopes: ["https://www.googleapis.com/auth/drive"]
  });
  this.auth.on("error", function() {});
});

describe("Error handler", function() {

  it("should emit errors", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.error, function() {
      done();
    });
    auth._emitError(GoogleDeviceAuth.errors.googleError);
  });

  it("should be able to emit specific errors", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.authorizationTimeout, function() {
      done();
    });
    auth._emitError(GoogleDeviceAuth.errors.authorizationTimeout);
  });

  it("should emit errors with codes", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.authorizationTimeout, function(err) {
      expect(err.code).to.equal("authorization_timeout");
      done();
    });
    auth._emitError(GoogleDeviceAuth.errors.authorizationTimeout);
  });

  it("should emit errors with data", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.authorizationTimeout, function(err) {
      expect(err.data).to.equal("test");
      done();
    });
    auth._emitError(GoogleDeviceAuth.errors.authorizationTimeout, "test");
  });

  _.each(GoogleDeviceAuth.errors, function(error, key) {
    it("should emit error type " + key, function(done) {
      var auth = this.auth;
      auth.on(GoogleDeviceAuth.events.errors[key], function(err) {
        expect(err.code).to.equal(error.code);
        expect(err.message).to.equal(error.string);
        done();
      });
      auth._emitError(error);
    });
  });

});

describe("Constructor", function() {

  it("should pass options to instance", function() {
    var auth = this.auth;
    expect(auth.options.clientId).to.equal("testid");
  });

  it("should set authData to be an empty object", function() {
    var auth = this.auth;
    expect(auth.authData).to.be.ok();
  });

});

describe("Auth method", function() {

  it("should not run if required options are not set", function(done) {
    var auth = this.auth;
    delete auth.options.clientId;
    auth.options.scopes = [];
    var run = false;
    auth._requestUserCode = function() {
      run = true;
    };
    auth.auth();
    expect(run).to.equal(false);
    done();
  });

  it("should run refresh if refreshToken exists", function(done) {
    var auth = this.auth;
    auth.refresh = done;
    auth.options.refreshToken = "test";
    auth.auth();
  });

});

describe("User code request handler", function() {

  it("should trigger userCode event with correct data", function(done) {
    var auth = this.auth;
    auth._makeRequest = function(options, callback) {
      callback({
        device_code : "device_code",
        user_code : "user_code",
        verification_url : "verification_url",
        expires_in : 100,
        interval : 5
      });
    };
    auth.on(GoogleDeviceAuth.events.userCode, function(data) {
      expect(data.device_code).to.equal("device_code");
      done();
    });
    auth.auth();
  });

  it("should start polling when usercode is returned", function(done) {
    var auth = this.auth;
    auth._makeRequest = function(options, callback) {
      callback({
        device_code : "device_code",
        user_code : "user_code",
        verification_url : "verification_url",
        expires_in : 100,
        interval : 5
      });
    };
    auth._pollAuthEndpoint = function() {
      done();
    };
    auth.auth();
  });

  it("should set poll start time when polling is started", function(done) {
    var auth = this.auth;
    auth._makeRequest = function(options, callback) {
      callback({
        device_code : "device_code",
        user_code : "user_code",
        verification_url : "verification_url",
        expires_in : 100,
        interval : 5
      });
    };
    auth._pollAuthEndpoint = function() {
      expect(auth._pollStartTime).to.be.ok();
      done();
    };
    auth.auth();
  });

});

describe("Poll response handler", function() {

  it("should re-call _pollAuthEndpoint on authorization_pending", function(done) {
    var auth = this.auth;
    auth._pollAuthEndpoint = function() {
      done();
    };
    auth._userCode = {
      interval: 1
    };
    auth._handlePollResponse({
      error: "authorization_pending"
    });
  });

  it("should re-call _pollAuthEndpoint on slow_down and increment userCode interval", function(done) {
    var auth = this.auth;
    auth._pollAuthEndpoint = function() {
      expect(auth._userCode.interval).to.equal(2);
      done();
    };
    auth._userCode = {
      interval: 1
    };
    auth._handlePollResponse({
      error: "slow_down"
    });
  });

  it("should emit a google error with data on unexpected error", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.googleError, function(err) {
      expect(err.data.error).to.equal("unknown");
      done();
    });
    auth._handlePollResponse({
      error: "unknown"
    });
  });

  it("should emit an authSuccess with data on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
      expect(data.access_token).to.equal("test");
      done();
    });
    auth._handlePollResponse({
      access_token: "test"
    });
  });

  it("should store final data in authData on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
      expect(auth.authData.access_token).to.equal("test");
      done();
    });
    auth._handlePollResponse({
      access_token: "test"
    });
  });

  it("should store refreshToken in options.refreshToken on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
      expect(auth.options.refreshToken).to.equal("test");
      done();
    });
    auth._handlePollResponse({
      access_token: "test",
      refresh_token: "test"
    });
  });

  it("should emit a newAccessToken event on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.newAccessToken, function(data) {
      expect(data.access_token).to.equal("test");
      done();
    });
    auth._handlePollResponse({
      access_token: "test"
    });
  });

});

describe("Refresh method", function() {

  it("should call auth method if options.refreshToken is not present", function(done) {
    var auth = this.auth;
    auth.auth = done;
    auth.refresh();
  });

  it("should not run if required options are missing", function(done) {
    var auth = this.auth;
    auth.options.refreshToken = "test";
    delete auth.options.clientId;
    delete auth.options.clientSecret;
    var run = false;
    auth._requestTokenRefresh = function() {
      run = true;
    };
    auth.refresh();
    expect(run).to.equal(false);
    done();
  });

});

describe("Refresh response handler", function() {

  it("should emit invalid refresh token error on invalid_grant error response", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.invalidRefreshToken, function() {
      done();
    });
    auth._handleRefreshResponse({
      error: "invalid_grant"
    });
    auth.refresh();
  });

  it("should emit refresh success on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.refreshSuccess, function(data) {
      expect(data.access_token).to.equal("test");
      done();
    });
    auth._handleRefreshResponse({
      access_token: "test"
    });
    auth.refresh();
  });

  it("should emit newAccessToken on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.newAccessToken, function(data) {
      expect(data.access_token).to.equal("test");
      done();
    });
    auth._handleRefreshResponse({
      access_token: "test"
    });
    auth.refresh();
  });

  it("should store new data in authData on success", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.refreshSuccess, function(data) {
      expect(auth.authData.access_token).to.equal("test");
      done();
    });
    auth._handleRefreshResponse({
      access_token: "test"
    });
    auth.refresh();
  });

  it("should emit a google error with data on unexpected error", function(done) {
    var auth = this.auth;
    auth.on(GoogleDeviceAuth.events.errors.googleError, function(err) {
      expect(err.data.error).to.equal("unknown");
      done();
    });
    auth._handleRefreshResponse({
      error: "unknown"
    });
  });

});