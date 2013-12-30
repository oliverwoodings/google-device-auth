# NodeJS Google OAuth2.0 authentication for limited-input devices

Allows limited-input devices to authenticate with Google OAuth2. Uses could be a command-line service or applications running on a headless server.

For detailed information on Google Limited Device Authorisation, see this article: https://developers.google.com/accounts/docs/OAuth2ForDevices

## Quick Example:

```
var GoogleDeviceAuth = require("google-device-auth");

var deviceAuth = new GoogleDeviceAuth({
  clientId: "<insert client id>",
  clientSecret: "<insert client secret>",
  scopes: [
    "https://www.googleapis.com/auth/drive"
  ]
});

deviceAuth.on(GoogleDeviceAuth.events.userCode, function(data) {
  //Present user code data to the user for authorization
});

deviceAuth.on(GoogleDeviceAuth.events.authSuccess, function(data) {
  //Store response access token and refresh token for use with other libraries
});

deviceAuth.auth();
```


## API

### GoogleDeviceAuth(options)

Creates a new GoogleDeviceAuth instance with the specified options. Options may contain the following:

 * `clientId`: *(required)* Google Client ID obtained from the developer console
 * `clientSecret`: *(required)* Google Client Secret obtained from the developer console
 * `scopes`: *(required)* Scopes that you are requesting access to. See below for more info on scopes
 * `refreshToken`: *(optional)* If you already have a refresh token, you can supply it to the library. This parameter is auto filled out if the `GoogleDeviceAuth.auth()` method is successful.
 * `autoAttemptReAuth`: *(optional)* If a refresh attempt fails due to the access token failing, the library will auto attempt to retry an authentication request if this is set to true. Default is true.


### GoogleDeviceAuth.auth()

Initiates an authentication request by requesting a user code from the Google OAuth API. On success, a `GoogleDeviceAuth.events.userCode` event will be emitted containing the URL and user code that should be presented to the user. See below for more information on user codes.

Once the request has been authorised by the user, a token request will be sent and the result emitted by a `GoogleDeviceAuth.events.authSuccess` event. See below for information on event data.


### GoogleDeviceAuth.refresh()

Initiates a token refresh request. A refresh token _must_ be present in `options.refreshToken` for this to work. Note that this parameter is automatically filled out by the `GoogleDeviceAuth.auth()` method, so you only need to set it manually if you obtained a token from somewhere else.

If the request fails due to an expired access_token, a new authentication request will be made if `options.autoAttemptReAuth` is set to true.

On success a `GoogleDeviceAuth.events.refreshSuccess` event is emitted containing new access_token data.


## Events

* ####`GoogleDeviceAuth.events.userCode`:
  Emitted after an auth request is initiated. The data sent by this event contains the verification URL and code that need to be presented to the user. Here is an example of this object:

    ```
    {
      "device_code" : "4/L9fTtLrhY96442SEuf1Rl3KLFg3y",
      "user_code" : "a9xfwk9c",
      "verification_url" : "http://www.google.com/device",
      "expires_in" : 1800,
      "interval" : 5
    }
    ```

  The `user_code` and `verification_url` should be given to the user (e.g. printed to the console, emailed to someone) so they can authenticate the request. If this is not completed in `expires_in` seconds, the authentication request will fail and an error will be emitted.

* ####`GoogleDeviceAuth.events.error`:
  The error event is essential for understanding reasons for authentication failure. Application errors will be emitted as standard Error objects with an additional `code` parameter that can be used to determine the source of the problem, as well as a `data` parameter where relevant. Note that the errors are not always 'bad' and might simply mean that a new authentication attempt needs to take place, for example. For a full list of errors and their codes please see below.

* ####`GoogleDeviceAuth.events.authSuccess`:
  Emitted on successful authentication. The data sent by this event contains important information such as the `access_token` and the `refresh_token` for use in your application. Here is an example of this object:

    ```
    {
      "access_token" : "ya29.AHES6ZSuY8f6WFLswSv0HELP2J4cCvFSj-8GiZM0Pr6cgXU",
      "token_type" : "Bearer",
      "expires_in" : 3600,
      "refresh_token" : "1/551G1yXUqgkDGnkfFk6ZbjMLMDIMxo3JFc8lY8CAR-Q",
      "id_token" : "eyJhbGciOiJSUzI1NiIsImtpZCI6IjAxZmM3ZTUyOTQwN2U1NGM0M2ViYzA3NDE0M2Q5MWY3NTRlZjVhMGIifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXVkIjoiMjM4MjUyNTI0OTMwLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiY2lkIjoiMjM4MjUyNTI0OTMwLmFwcHMuZ29vZyNzMY5MTB9.QXfo4_WJAWRisRj5GfFJ4YZtYWFdg7TNnM5TQuFkstTa5MrSYELy2UW-lEPOTaXfFa7QKhf_2lEIK1bqYvOPILnirBqCkDz9Z-TnNH8Lf8lvT1HsG7oi86pt-9Y8KK08JSyd0v3Fe0iLHRwtwcTqSIwbSnt8szFwsCW4d5Xxzl8"
    }
    ```

  When this event is emitted the `refresh_token` is automatically stored in the `options.refreshToken` parameter of the GoogleDeviceAuth instance so that the `GoogleDeviceAuth.refresh()` method can be used easily.

  *Important note*: You should _permanently_ store the refresh token until it becomes invalid since this is the easiest way to get new access tokens. The Google OAuth system restricts the availability of refresh tokens so it is important to only request it when absolutely necessary.

* ####`GoogleDeviceAuth.events.refreshSuccess`:
  Emitted on successful access token refresh. An example of the data sent by this event:

    ```
    {
      "access_token" : "ya29.AHES6ZSuY8f6WFLswSv0HELP2J4cCvFSj-8GiZM0Pr6cgXU",
      "token_type" : "Bearer",
      "expires_in" : 3600,
      "id_token" : "eyJhbGciOiJSUzI1NiIsImtpZCI6IjAxZmM3ZTUyOTQwN2U1NGM0M2ViYzA3NDE0M2Q5MWY3NTRlZjVhMGIifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXVkIjoiMjM4MjUyNTI0OTMwLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiY2lkIjoiMjM4MjUyNTI0OTMwLmFwcHMuZ29vZyNzMY5MTB9.QXfo4_WJAWRisRj5GfFJ4YZtYWFdg7TNnM5TQuFkstTa5MrSYELy2UW-lEPOTaXfFa7QKhf_2lEIK1bqYvOPILnirBqCkDz9Z-TnNH8Lf8lvT1HsG7oi86pt-9Y8KK08JSyd0v3Fe0iLHRwtwcTqSIwbSnt8szFwsCW4d5Xxzl8"
    }
    ```

  Note that if a refresh request fails, an authentication request will automatically be sent unless `options.autoAttemptReAuth` is false (true by default)


## Errors

Errors emitted by GoogleDeviceAuth are designed to be as precise as possible, allowing you to easily establish why an authentication request failed. Application error objects contain a parameter, `code` that can be matched against the following list:

* `missing_client_id`: Missing client ID in options object
* `missing_scopes`: Scopes array is empty in options
* `missing_secret`: Missing client secret in options
* `missing_refresh_token`: Missing refresh token in options
* `authorization_timeout`: User did not authorize in time
* `google_error`: Error returned from Google Auth
* `no_user_code`: Unable to poll endpoint - no usercode data
* `invalid_refresh_token`: Invalid refresh token provided

Example of checking for a specific error:

```
deviceAuth.on(GoogleDeviceAuth.error, function(err) {
  if (err.code == "authorization_timeout") {
    console.log("You failed to authorize the request in time! Please try again...");
    deviceAuth.auth();
  }
});
```


## Scopes

Scopes tell the user which Google APIs you are requesting access to and in what form (e.g. readonly). There is no definitive list of all possible scopes. Instead, you have to find them from the Google Discovery API, which can be found here: https://developers.google.com/discovery/v1/getting_started

The Discovery API contains information about all the different Google APIs. For example, to list all the available APIs you can go here: https://www.googleapis.com/discovery/v1/apis
If I wanted to find out the scope for the Google Drive v2 API, I would go here: https://www.googleapis.com/discovery/v1/apis/drive/v2/rest and then look for the `scopes` object/array.