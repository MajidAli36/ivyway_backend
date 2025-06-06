const { google } = require("googleapis");
const { oAuth2Client } = require("../config/google-calendar");
const { CalendarIntegration } = require("../models");
const { serverError } = require("../utils/error-handler");

/**
 * Sets auth credentials for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Google Auth client
 */
const getAuthClientForUser = async (userId) => {
  try {
    const integration = await CalendarIntegration.findOne({
      where: { userId, active: true },
    });

    if (!integration) {
      throw new Error("No calendar integration found for user");
    }

    // Set credentials
    oAuth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.tokenExpiry.getTime(),
    });

    // Setup token refresh callback
    oAuth2Client.on("tokens", async (tokens) => {
      if (tokens.refresh_token) {
        integration.refreshToken = tokens.refresh_token;
      }
      if (tokens.access_token) {
        integration.accessToken = tokens.access_token;
        integration.tokenExpiry = new Date(tokens.expiry_date);
        await integration.save();
      }
    });

    return oAuth2Client;
  } catch (error) {
    console.error("Error getting auth client for user:", error);
    throw serverError("Failed to authenticate with Google Calendar");
  }
};

/**
 * Lists all calendars for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of calendars
 */
const listCalendars = async (userId) => {
  try {
    const auth = await getAuthClientForUser(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.calendarList.list();
    return response.data.items;
  } catch (error) {
    console.error("Error listing calendars:", error);
    throw serverError("Failed to list calendars");
  }
};

/**
 * Creates a calendar event
 * @param {string} userId - User ID
 * @param {Object} eventDetails - Event details
 * @returns {Promise<Object>} Created event
 */
const createEvent = async (userId, eventDetails) => {
  try {
    const auth = await getAuthClientForUser(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const integration = await CalendarIntegration.findOne({
      where: { userId, active: true },
    });

    const calendarId = integration.calendarId || "primary";

    const event = {
      summary: eventDetails.title,
      description: eventDetails.description,
      start: {
        dateTime: new Date(eventDetails.startTime).toISOString(),
        timeZone: eventDetails.timezone || "UTC",
      },
      end: {
        dateTime: new Date(eventDetails.endTime).toISOString(),
        timeZone: eventDetails.timezone || "UTC",
      },
      attendees: eventDetails.attendees || [],
      conferenceData: {
        createRequest: {
          requestId: `booking-${eventDetails.bookingId}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      resource: event,
    });

    return response.data;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw serverError("Failed to create calendar event");
  }
};

/**
 * Updates a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Google Calendar event ID
 * @param {Object} eventDetails - Updated event details
 * @returns {Promise<Object>} Updated event
 */
const updateEvent = async (userId, eventId, eventDetails) => {
  try {
    const auth = await getAuthClientForUser(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const integration = await CalendarIntegration.findOne({
      where: { userId, active: true },
    });

    const calendarId = integration.calendarId || "primary";

    // Get existing event
    const { data: existingEvent } = await calendar.events.get({
      calendarId,
      eventId,
    });

    // Update event fields
    const updatedEvent = {
      ...existingEvent,
      summary: eventDetails.title || existingEvent.summary,
      description: eventDetails.description || existingEvent.description,
      start: eventDetails.startTime
        ? {
            dateTime: new Date(eventDetails.startTime).toISOString(),
            timeZone: eventDetails.timezone || existingEvent.start.timeZone,
          }
        : existingEvent.start,
      end: eventDetails.endTime
        ? {
            dateTime: new Date(eventDetails.endTime).toISOString(),
            timeZone: eventDetails.timezone || existingEvent.end.timeZone,
          }
        : existingEvent.end,
    };

    const response = await calendar.events.update({
      calendarId,
      eventId,
      resource: updatedEvent,
    });

    return response.data;
  } catch (error) {
    console.error("Error updating calendar event:", error);
    throw serverError("Failed to update calendar event");
  }
};

/**
 * Deletes a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Google Calendar event ID
 * @returns {Promise<boolean>} Success status
 */
const deleteEvent = async (userId, eventId) => {
  try {
    const auth = await getAuthClientForUser(userId);
    const calendar = google.calendar({ version: "v3", auth });

    const integration = await CalendarIntegration.findOne({
      where: { userId, active: true },
    });

    const calendarId = integration.calendarId || "primary";

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    throw serverError("Failed to delete calendar event");
  }
};

module.exports = {
  getAuthClientForUser,
  listCalendars,
  createEvent,
  updateEvent,
  deleteEvent,
};
