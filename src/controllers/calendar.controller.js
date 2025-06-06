const { CalendarIntegration } = require("../models");
const googleCalendarService = require("../services/google-calendar.service");
const { catchAsync } = require("../utils/error-handler");

/**
 * Connect user's account to Google Calendar
 */
const initiateGoogleCalendarConnection = catchAsync(async (req, res) => {
  const { userId } = req;
  const authUrl = await googleCalendarService.getAuthUrl(userId);
  res.status(200).json({ authUrl });
});

/**
 * Handle OAuth callback from Google
 */
const handleGoogleCallback = catchAsync(async (req, res) => {
  const { code } = req.query;
  const { userId } = req;

  const tokens = await googleCalendarService.exchangeCodeForTokens(code);

  await CalendarIntegration.upsert({
    userId,
    provider: "google",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  });

  res.redirect(process.env.FRONTEND_URL + "/calendar/connected");
});

/**
 * Disconnect Google Calendar integration
 */
const disconnectGoogleCalendar = catchAsync(async (req, res) => {
  const { userId } = req;

  const integration = await CalendarIntegration.findOne({
    where: { userId, provider: "google" },
  });

  if (integration) {
    await googleCalendarService.revokeAccess(integration.accessToken);
    await integration.destroy();
  }

  res
    .status(200)
    .json({ message: "Google Calendar disconnected successfully" });
});

/**
 * Sync events with Google Calendar
 */
const syncEvents = catchAsync(async (req, res) => {
  const { userId } = req;
  const { startDate, endDate } = req.query;

  const events = await googleCalendarService.getEvents(
    userId,
    startDate,
    endDate
  );

  res.status(200).json({ events });
});

/**
 * Create event in Google Calendar
 */
const createGoogleEvent = catchAsync(async (req, res) => {
  const { userId } = req;
  const { summary, description, start, end, attendees } = req.body;

  const createdEvent = await googleCalendarService.createEvent(userId, {
    summary,
    description,
    start,
    end,
    attendees,
  });

  res.status(201).json({ event: createdEvent });
});

module.exports = {
  initiateGoogleCalendarConnection,
  handleGoogleCallback,
  disconnectGoogleCalendar,
  syncEvents,
  createGoogleEvent,
};
