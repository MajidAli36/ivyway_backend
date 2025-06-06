const { google } = require("googleapis");
const env = require("./environment");

const oAuth2Client = new google.auth.OAuth2(
  env.googleCalendar.clientId,
  env.googleCalendar.clientSecret,
  env.googleCalendar.redirectUri
);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

const getAuthUrl = () => {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
};

module.exports = {
  oAuth2Client,
  SCOPES,
  getAuthUrl,
};
