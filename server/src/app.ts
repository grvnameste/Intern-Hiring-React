import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import leaveTypeRoutes from "./routes/leaveType.routes";
import leaveRequestRoutes from "./routes/leaveRequest.routes";
import reportRoutes from "./routes/report.routes";
import { HttpError } from "./utils/http";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/leave-types", leaveTypeRoutes);
  app.use("/api/leave-requests", leaveRequestRoutes);
  app.use("/api/reports", reportRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  };

  app.use(errorHandler);

  return app;
};
