const sgMail = require('@sendgrid/mail');
const env = require('../config/environment');

// Initialize SendGrid with API key
sgMail.setApiKey(env.sendgrid.apiKey);

/**
 * Sends an email using SendGrid
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @param {string} options.from - Sender email (optional, defaults to configured sender)
 * @returns {Promise<boolean>} Success status
 */
const sendEmail = async (options) => {
  try {
    const msg = {
      to: options.to,
      from: options.from || env.sendgrid.senderEmail,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid API error:', error.response.body);
    }
    return false;
  }
};

/**
 * Sends a booking confirmation email
 * @param {Object} booking - Booking details
 * @param {Object} recipient - Recipient user object
 * @param {Object} provider - Provider user object
 * @returns {Promise<boolean>} Success status
 */
const sendBookingConfirmationEmail = async (booking, recipient, provider) => {
  const dateOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const timeOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  };

  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  
  const formattedDate = startDate.toLocaleDateString('en-US', dateOptions);
  const formattedStartTime = startDate.toLocaleTimeString('en-US', timeOptions);
  const formattedEndTime = endDate.toLocaleTimeString('en-US', timeOptions);

  const subject = `Booking Confirmation: Session with ${provider.fullName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Booking is Confirmed</h2>
      <p>Hello ${recipient.fullName},</p>
      <p>Your session with ${provider.fullName} has been confirmed.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Session Details:</h3>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
        <p><strong>Type:</strong> ${booking.sessionType}</p>
        ${booking.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
        ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
      </div>
      
      <p>If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>
      <p>Thank you for using IvyWay!</p>
    </div>
  `;

  return await sendEmail({
    to: recipient.email,
    subject,
    text: `Your session with ${provider.fullName} on ${formattedDate} at ${formattedStartTime} has been confirmed.`,
    html
  });
};

/**
 * Sends a booking cancellation email
 * @param {Object} booking - Booking details
 * @param {Object} recipient - Recipient user object
 * @param {Object} canceller - User who cancelled the booking
 * @returns {Promise<boolean>} Success status
 */
const sendBookingCancellationEmail = async (booking, recipient, canceller) => {
  const dateOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const timeOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  };

  const startDate = new Date(booking.startTime);
  
  const formattedDate = startDate.toLocaleDateString('en-US', dateOptions);
  const formattedTime = startDate.toLocaleTimeString('en-US', timeOptions);

  const subject = `Booking Cancelled: Session on ${formattedDate}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Cancellation Notice</h2>
      <p>Hello ${recipient.fullName},</p>
      <p>A session scheduled for ${formattedDate} at ${formattedTime} has been cancelled by ${canceller.fullName}.</p>
      
      ${booking.cancellationReason ? `
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Cancellation Reason:</h3>
        <p>${booking.cancellationReason}</p>
      </div>
      ` : ''}
      
      <p>You can schedule a new session through the IvyWay platform.</p>
      <p>Thank you for your understanding.</p>
    </div>
  `;

  return await sendEmail({
    to: recipient.email,
    subject,
    text: `Your session scheduled for ${formattedDate} at ${formattedTime} has been cancelled. ${booking.cancellationReason ? `Reason: ${booking.cancellationReason}` : ''}`,
    html
  });
};

/**
 * Sends a booking rescheduled email
 * @param {Object} booking - Updated booking details
 * @param {Object} oldBooking - Previous booking details
 * @param {Object} recipient - Recipient user object
 * @param {Object} rescheduler - User who rescheduled the booking
 * @returns {Promise<boolean>} Success status
 */
const sendBookingRescheduledEmail = async (booking, oldBooking, recipient, rescheduler) => {
  const dateOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const timeOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  };

  const newStartDate = new Date(booking.startTime);
  const newEndDate = new Date(booking.endTime);
  const oldStartDate = new Date(oldBooking.startTime);
  
  const newFormattedDate = newStartDate.toLocaleDateString('en-US', dateOptions);
  const newFormattedStartTime = newStartDate.toLocaleTimeString('en-US', timeOptions);
  const newFormattedEndTime = newEndDate.toLocaleTimeString('en-US', timeOptions);
  
  const oldFormattedDate = oldStartDate.toLocaleDateString('en-US', dateOptions);
  const oldFormattedTime = oldStartDate.toLocaleTimeString('en-US', timeOptions);

  const subject = `Booking Rescheduled: Session Updated`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Session Has Been Rescheduled</h2>
      <p>Hello ${recipient.fullName},</p>
      <p>Your session has been rescheduled by ${rescheduler.fullName}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">New Session Details:</h3>
        <p><strong>Date:</strong> ${newFormattedDate}</p>
        <p><strong>Time:</strong> ${newFormattedStartTime} - ${newFormattedEndTime}</p>
        <p><strong>Type:</strong> ${booking.sessionType}</p>
        ${booking.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a></p>` : ''}
      </div>
      
      <p><em>Previous session was scheduled for ${oldFormattedDate} at ${oldFormattedTime}.</em></p>
      
      <p>If you need to make any changes, please do so through the IvyWay platform.</p>
      <p>Thank you for using IvyWay!</p>
    </div>
  `;

  return await sendEmail({
    to: recipient.email,
    subject,
    text: `Your session has been rescheduled from ${oldFormattedDate} at ${oldFormattedTime} to ${newFormattedDate} at ${newFormattedStartTime}.`,
    html
  });
};

/**
 * Sends a system notification email
 * @param {Object} recipient - Recipient user object
 * @param {string} title - Notification title
 * @param {string} content - Notification content
 * @returns {Promise<boolean>} Success status
 */
const sendSystemNotificationEmail = async (recipient, title, content) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
      <p>Hello ${recipient.fullName},</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p>${content}</p>
      </div>
      <p>Thank you for using IvyWay!</p>
    </div>
  `;

  return await sendEmail({
    to: recipient.email,
    subject: title,
    text: content,
    html
  });
};

module.exports = {
  sendEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingRescheduledEmail,
  sendSystemNotificationEmail
};