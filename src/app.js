const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const routes = require("./routes");
const path = require("path");
const { sequelize, testConnection } = require("./config/database");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/error.middleware");
const swagger = require("./config/swagger");
const http = require("http");
const { initializeSocket } = require("./services/socket.service");
// Add the missing import for messagingRoutes
const messagingRoutes = require("./routes/messaging.routes");

// Initialize app
const app = express();

// Apply middleware
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
const allowedOrigins = [
  "http://test-ivy-front-env.eba-gvau2638.us-east-1.elasticbeanstalk.com/",
  "http://test-ivy-front-env.eba-gvau2638.us-east-1.elasticbeanstalk.com",
  "https://main.d6hhbvtaerp6m.amplifyapp.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this to your existing app.js file, after the middleware section
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// Apply routes
app.use("/api", routes);
app.use("/api-docs", swagger.serve, swagger.setup);
// app.use("/api/messaging", messagingRoutes);

// Apply error handling
app.use(errorHandler);
app.use(notFoundHandler);

// Create HTTP server and initialize Socket.io
const server = http.createServer(app);
initializeSocket(server);

// Database connection and server startup
const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    // Use the testConnection function from database.js
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error("Failed to connect to database. Server won't start.");
      process.exit(1);
    }

    // Sync database models in development
    if (process.env.NODE_ENV === "development") {
      console.log("Syncing database models...");
      await sequelize.sync(); // Changed from sync({ force: true }) to sync()
      console.log("Database synced successfully");
    }

    // Start server using the HTTP server instance instead of app directly
    // This is important for Socket.io to work properly
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server with database connection
startServer();

module.exports = app;
