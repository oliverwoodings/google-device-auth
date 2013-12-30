//NB: these client details are for a dummy project, don't panic :)

var GoogleDeviceAuth = require("../lib/auth");

var deviceAuth = new GoogleDeviceAuth({
  clientId: "234896418929.apps.googleusercontent.com",
  clientSecret: "aMPwo8xNlNKl7mz-e3y2N6h5",
  scopes: [
    "https://docs.google.com/feeds/"
  ]
});

deviceAuth.on(GoogleDeviceAuth.events.userCode, function(data) {
  console.log("Please visit this URL: ", data.verification_url, " and enter this code: ", data.user_code);
});

deviceAuth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
  console.log("Auth success! Access token: ", data.access_token);
});

deviceAuth.on(GoogleDeviceAuth.events.errors.authorizationTimeout, function() {
  console.log("Authorization timed out! Please try with new code...");
  deviceAuth.auth();
});

deviceAuth.on(GoogleDeviceAuth.events.error, function(err) {
  console.log(err);
});

deviceAuth.auth();