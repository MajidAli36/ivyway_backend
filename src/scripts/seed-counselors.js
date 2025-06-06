const { User, CounselorProfile } = require("../models");
const { sequelize } = require("../config/database");
const { v4: uuidv4 } = require("uuid");

async function seedCounselors() {
  try {
    console.log("Starting counselor seeding...");

    // Create counselor users first
    const counselorUsers = [
      {
        id: uuidv4(),
        firebaseId: `counselor-${uuidv4()}`,
        fullName: "Dr. Sarah Johnson",
        email: "sarah.johnson@example.com",
        role: "counselor",
      },
      {
        id: uuidv4(),
        firebaseId: `counselor-${uuidv4()}`,
        fullName: "Dr. Michael Chen",
        email: "michael.chen@example.com",
        role: "counselor",
      },
      {
        id: uuidv4(),
        firebaseId: `counselor-${uuidv4()}`,
        fullName: "Dr. Emily Rodriguez",
        email: "emily.rodriguez@example.com",
        role: "counselor",
      },
    ];

    // Create users
    const createdUsers = [];
    for (const userData of counselorUsers) {
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData,
      });

      createdUsers.push(user);
      console.log(`${created ? "Created" : "Found"} user: ${user.fullName}`);
    }

    // Create counselor profiles for each user
    for (const user of createdUsers) {
      const [profile, created] = await CounselorProfile.findOrCreate({
        where: { userId: user.id },
        defaults: {
          userId: user.id,
          bio: `${user.fullName} is an experienced counselor specializing in academic and career guidance.`,
          education: "Ph.D. in Psychology, Stanford University",
          specialization: "Academic Counseling",
          experience: Math.floor(Math.random() * 10) + 5, // 5-15 years of experience
          languages: ["English", "Spanish"],
          hourlyRate: Math.floor(Math.random() * 50) + 50, // $50-100 hourly rate
        },
      });

      console.log(
        `${created ? "Created" : "Found"} counselor profile for: ${
          user.fullName
        }`
      );
    }

    console.log("Counselor seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding counselors:", error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

// Run the seeding function
seedCounselors();
