const { WaitlistUser } = require("../models");
const { success } = require("../utils/response-formatter");
const { catchAsync, badRequest } = require("../utils/error-handler");
const emailService = require("../services/email.service");
const env = require("../config/environment");

/**
 * Add a user to the waitlist
 */
const addToWaitlist = catchAsync(async (req, res) => {
  const { fullName, email, phoneNumber, message } = req.body;

  // Validate required fields
  if (!fullName || !email || !phoneNumber) {
    throw badRequest("Name, email and phone number are required");
  }

  // Check if email already exists
  const existingUser = await WaitlistUser.findOne({ where: { email } });
  if (existingUser) {
    return res.json(
      success(null, "Thank you! You're already on our waitlist.")
    );
  }

  // Create waitlist entry
  const waitlistUser = await WaitlistUser.create({
    fullName,
    email,
    phoneNumber,
    message: message || null,
  });

  // Send email notification to admin
  const adminEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Waitlist Submission</h2>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">User Details:</h3>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phoneNumber}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  try {
    await emailService.sendEmail({
      to: env.admin.email,
      subject: "New Waitlist Submission - IvyWay",
      text: `New waitlist submission from ${fullName} (${email})`,
      html: adminEmailHtml,
    });
  } catch (error) {
    console.error("Error sending admin notification:", error);
    // Don't let email failure affect the API response
  }

  res
    .status(201)
    .json(success(waitlistUser, "Thank you for joining our waitlist!"));
});

/**
 * Get all waitlist users (admin only)
 */
const getWaitlistUsers = catchAsync(async (req, res) => {
  const waitlistUsers = await WaitlistUser.findAll({
    order: [["createdAt", "DESC"]],
  });

  res.json(success(waitlistUsers, "Waitlist users retrieved successfully"));
});

module.exports = {
  addToWaitlist,
  getWaitlistUsers,
};
